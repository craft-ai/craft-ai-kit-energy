import pandas as pd
import numpy as np
import os
import matplotlib.pyplot as plt
import craftai
import craftai.pandas
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from statsmodels.tsa.statespace.sarimax import SARIMAX
import itertools
import seaborn as sns
from fbprophet import Prophet
import imp
import subprocess
from sklearn.metrics import r2_score

#configurating seaborn
palette = sns.color_palette("Set2", 10, 0.9)
sns.set_palette(palette)
sns.set_style("dark")

def split_data(data, last_train_index, last_test_index):
    data_train = data.iloc[:last_train_index,:]
    data_test = data.iloc[last_train_index:last_test_index,:]
    return data_train, data_test

def MAE(gv, preds):
    '''
    input : 2 arrays with the same dims, output : mean absolute error
    '''  
    return np.round(np.nansum(np.abs(preds - gv)) / len(preds),2)

def RMSE(gv, preds):
    '''
    input : 2 arrays with the same dims, output : root mean square error
    '''  
    return np.round(np.sqrt(np.nansum(np.square(preds - gv)) / len(preds)),2)

def MAPE(gv, preds):
    '''
    input : 2 arrays with the same dims, output : mean absolute percentage error
    '''  
    mape = np.nansum(np.abs((preds - gv) / gv)) / len(preds) * 100
    return np.round(mape, 2)

def R2(gv, preds):
    '''
    input : 2 arrays with the same dims, output : r2 error
    ''' 
    # residual sum of squares
    ss_res = np.nansum(np.square(preds - gv))
    # total sum of squares
    ss_tot = np.nansum(np.square(gv - np.nanmean(gv)))
    return 1 - ss_res / ss_tot

def compute_metric(gv, preds, metric):
    if metric =='mape':
        return MAPE(gv, preds)
    elif metric == 'rmse':
        return RMSE(gv, preds)
    elif metric == 'r2':
        return R2(gv, preds)
    return MAE(gv, preds)

def get_features_from_index(df):
    new_df = df.copy(deep=True).dropna()
    new_df['hour'] = new_df.index.hour
    new_df['day'] = new_df.index.dayofweek
    new_df['month'] = new_df.index.month
    new_df['year'] = new_df.index.year
    return new_df

def get_craft_preds(start_train =1, stop_train=2, start_pred=2, stop_pred=3, node_file = "load_benchmark_ampds"):
    command = ['node', node_file, '--start_train', str(start_train), '--stop_train', str(stop_train), '--start_pred', str(start_pred), '--stop_pred', str(stop_pred)]
    craft_preds = pd.read_json(subprocess.check_output(command), convert_dates=['date']).set_index('date')
    return craft_preds[['predictedLoad', 'standardDeviation']]

def get_scikit_preds(data_train, data_test, max_depth=8, exog = None):
    sk_train = get_features_from_index(data_train)
    sk_test = get_features_from_index(data_test)
    features = ['hour', 'day', 'month', 'year'] +  exog if exog else ['hour', 'day', 'month', 'year']
    skTree = DecisionTreeRegressor(criterion = 'mse', max_depth=max_depth, random_state=0)
    skTree.fit(sk_train[features], sk_train['load'])
    sk_results = skTree.predict(sk_test[features])
    return sk_results

def get_forest_preds(data_train, data_test, n_estimators=6, max_depth=9, exog = None):
    sk_train = get_features_from_index(data_train)
    sk_test = get_features_from_index(data_test)
    features = ['hour', 'day', 'month', 'year'] +  exog if exog else ['hour', 'day', 'month', 'year']
    skForest = RandomForestRegressor(n_estimators=n_estimators, criterion='mse', max_depth=max_depth, random_state=0, bootstrap=True)
    skForest.fit(sk_train[features], sk_train['load'])
    results = skForest.predict(sk_test[features])
    return results

def get_prophet_preds(data_train, data_test, exog = None):
    prophet_train = data_train.copy(deep=True)
    prophet_test = data_test.copy(deep=True)
    prophet_train.index = prophet_train.index.tz_localize(None)
    prophet_test.index = prophet_test.index.tz_localize(None)
    prophet_train = prophet_train.reset_index().rename(columns={'date':'ds', 'load': 'y'})
    pm = Prophet()
    if exog:
        for ex in exog :
            pm.add_regressor(ex)
    pm.fit(prophet_train)
    future = prophet_test.drop('load', 1).reset_index().rename(columns={'date':'ds'})
    forecast = pm.predict(future)

    return forecast['yhat'].values

def get_sarima_preds(data_train, data_test, week_unit, params, seasonal_params, max_feed=3000, exog=None):
    #To avoid memory errors, let's train our sarima model on the last max_feed entries only
    sarima_train = data_train if data_train.shape[0] < max_feed else data_train.iloc[-max_feed:,:]
    model = SARIMAX(sarima_train.loc[:,'load'].values,
                            order= params, 
                            seasonal_order = seasonal_params,
                            exog = sarima_train.iloc[:,1],
                            enforce_stationarity=False, 
                            enforce_invertibility=False)
    sarima_results = model.fit()
    sarima_pred = sarima_results.get_prediction(data_test.index[0], data_test.index[-1], dynamic=False, exog=data_test[exog])

    return sarima_pred.predicted_mean

def get_models_scores(data_test, predictions, idx):
    """ data_test: ground values dataframe
    predictions: array of arrays
    idx: array of names of diff models
    Return dataframe of scores """
    
    ground_values = data_test['load'].values
    maes=[]
    mapes=[]
    rmse=[]
    r2=[]
    for pred in predictions:
        gv = ground_values if len(pred) == len(ground_values) else ground_values[:len(pred)]
        maes.append(MAE(gv,pred))
        rmse.append(RMSE(gv,pred))
        mapes.append(MAPE(gv,pred))
        r2.append(r2_score(gv,pred))
    
    scores = pd.DataFrame(data={
        'ids': idx,
        'mae': maes,
        'mape': mapes,
        'rmse': rmse,
        'r2' :  r2
    })
    return scores.set_index('ids')

def plot_period_predictions(data_test, predictions, standardDev=False, low_val=None, upper_val=None):
    """
    data_test : DataFrame with the test data
    predictions : dictionary with the names of the predictions as keys, and the predictions as values
    """
    df_compare = data_test.copy(deep=True)
    assert type(predictions) == dict
    for name, preds in predictions.items():
            try: 
                if preds.predictedLoad.any():
                    df_compare[name] = preds.predictedLoad 
                    continue
        
            except : pass
            if preds.any():
                df_compare[name] = preds

    fig = plt.figure(figsize=(20,5))
    sns.lineplot(data=df_compare, dashes=False)
    if standardDev == True:
        try: 
            if (low_val.any() and upper_val.any()):
                plt.fill_between(x=df_compare.index, y1=low_val, y2=upper_val, alpha=0.2, color=palette[1])
        except: pass
    
    plt.show()