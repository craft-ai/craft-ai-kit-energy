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

#configurating seaborn
palette = sns.color_palette("Set2", 10, 0.9)
sns.set_palette(palette)
sns.set_style("dark")

def split_data(data, last_train_index, last_test_index):
    data_train= data.iloc[:last_train_index,:]
    data_test = data.iloc[last_train_index:last_test_index,:]
    return data_train, data_test

def compute_mae(gv, preds):
    '''
    input : 2 arrays with the same dims, output : mean absolute error
    '''  
    return np.round(np.nansum(np.abs(preds- gv))/len(preds))

def compute_rmse(gv, preds):
    '''
    input : 2 arrays with the same dims, output : root mean square error
    '''  
    return np.round(np.sqrt(np.nansum(np.square(preds- gv))/len(preds)))

def compute_mape(gv, preds):
    '''
    input : 2 arrays with the same dims, output : mean absolute percentage error
    '''  
    return np.round(np.nansum(np.abs(preds- gv)/gv)/len(preds),4)*100

def compute_r2(gv, preds):
    '''
    input : 2 arrays with the same dims, output : r2 error
    '''  
    return 1 - np.nansum(np.square(preds- gv))/np.nansum(np.square(np.mean(gv)- gv))

def compute_metric(gv, preds, metric):
    if metric=='mape':
        return compute_mape(gv, preds)
    if metric == 'rmse':
        return compute_rmse(gv, preds)
    if metric == 'r2':
        return compute_r2(gv, preds)
    return compute_mae(gv, preds)

def get_features_from_index(df):
    new_df = df.copy(deep=True).dropna()
    new_df['hour'] = new_df.index.hour
    new_df['day'] = new_df.index.day
    new_df['month'] = new_df.index.month
    new_df['year'] = new_df.index.year
    return new_df

def get_craft_preds(start_train =1, stop_train=2, start_pred=2, stop_pred=3, node_file = "load_benchmark_ampds"):
    command = ['node', node_file, '--start_train', str(start_train), '--stop_train', str(stop_train), '--start_pred', str(start_pred), '--stop_pred', str(stop_pred)]
    craft_preds = pd.read_json(subprocess.check_output(command), convert_dates=['date']).set_index('date')
    return craft_preds[['predictedLoad', 'standardDeviation']]

def get_scikit_preds(data_train, data_test):
    sk_train = get_features_from_index(data_train)
    sk_test = get_features_from_index(data_test)
    skTree = DecisionTreeRegressor(criterion = 'mse', max_depth=3, random_state=0)
    skTree.fit(sk_train[['hour', 'day', 'month', 'year', 'temp']], sk_train['load'])
    sk_results = skTree.predict(sk_test[['hour', 'day', 'month', 'year', 'temp']])
    return sk_results

def get_forest_preds(data_train, data_test):
    sk_train = get_features_from_index(data_train)
    sk_test = get_features_from_index(data_test)
    skForest = RandomForestRegressor(n_estimators=9, criterion = 'mse', max_depth=6, random_state=0, bootstrap=True)
    skForest.fit(sk_train[['hour', 'day', 'month', 'year', 'temp']], sk_train['load'])
    results = skForest.predict(sk_test[['hour', 'day', 'month', 'year', 'temp']])
    return results

def get_prophet_preds(data_train, data_test):
    prophet_train = data_train.reset_index().rename(columns={'date':'ds', 'load': 'y'})
    pm = Prophet()
    pm.add_regressor('temp')
    pm.fit(prophet_train)
    future = data_test.drop('load',1).reset_index().rename(columns={'date':'ds'})
    forecast = pm.predict(future)

    return forecast['yhat'].values



def get_sarima_preds(data_train,data_test,week_unit, max_feed=3000):
    #To avoid memory errors, let's train our sarima model on the last max_feed entries only
    
    sarima_train = data_train if data_train.shape[0] < max_feed else data_train.iloc[-max_feed:,:]
    model = SARIMAX(sarima_train.loc[:,'load'].values[-5000:],
                            order= (1,0,1), 
                            seasonal_order = (0,1,1,48),
                            exog = sarima_train.iloc[-5000:,1],
                            enforce_stationarity=False, 
                            enforce_invertibility=False)
    sarima_results = model.fit()
    sarima_pred = sarima_results.get_prediction(data_test.index[0], data_test.index[-1], dynamic=False, exog = data_test[['temp']])

    return sarima_pred.predicted_mean

def get_models_scores(data_test, predictions, idx):
    """
    data_test : ground values dataframe
    predictions : array of arrays
    idx: array of names of diff models
    Return dataframe of scores
    """

    ground_values = data_test['load'].values
    maes=[]
    mapes=[]
    rmse=[]
    r2=[]
    for pred in predictions:
        gv = ground_values if len(pred) == len(ground_values) else ground_values[:len(pred)]
        maes.append(compute_mae(gv,pred))
        rmse.append(compute_rmse(gv,pred))
        mapes.append(compute_mape(gv,pred))
        r2.append(compute_r2(gv,pred))
    
    scores = pd.DataFrame(data={
        'ids': idx,
        'mae': maes,
        'mape': mapes,
        'rmse': rmse,
        'r2' :  r2
    })
    return scores 

def plot_period_predictions(data_test,  predictions, standardDev = False, low_val=None,upper_val=None):
    """
    data_test : DataFrame with the test data
    predictions : dictionary with the names of the predictions as keys, and the predictions as values
    """
    df_compare = data_test.copy(deep=True)
    assert type(predictions) == dict
    for name, preds in predictions.items():
        try: 
            if preds.any(): df_compare[name] = preds
        except: pass
    
    fig = plt.figure(figsize=(20,5))
    sns.lineplot(data=df_compare, dashes=False)
    
    if standardDev == True:
        try: 
            if (low_val.any() and  upper_val.any()):
                plt.fill_between(x=df_compare.index, y1 = low_val, y2 =upper_val, alpha=0.2, color=palette[1])
        except: pass