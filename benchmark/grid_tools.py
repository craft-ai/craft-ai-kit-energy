import pandas as pd
import numpy as np
import os
import matplotlib.pyplot as plt
import craftai.pandas
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from statsmodels.tsa.statespace.sarimax import SARIMAX
import itertools
import seaborn as sns
from fbprophet import Prophet
import imp
import benchmark_tools as bt 

#configurating seaborn
palette = sns.color_palette("Set2", 10, 0.9)
sns.set_palette(palette)
sns.set_style("dark")


def scikit_param_search(data_train, data_test, exog=None):
    '''
    exog =  Array with exogenous features
    '''
    
    sk_train = bt.get_features_from_index(data_train)
    sk_test = bt.get_features_from_index(data_test) #predict on 2 weeks
    features = ['hour', 'day', 'month', 'year'] +  exog if exog else ['hour', 'day', 'month', 'year']
    maes=[]
    rmse=[]
    r2 = []
    depth=[]
    for i in range(1,12):
    #     print('Training scikit Regressor Tree with a depth of ', i)
    # TO DO :  handling of exog features !!!

        skTree = DecisionTreeRegressor(criterion = 'mse', max_depth=i, random_state=0)
        skTree.fit(sk_train[features], sk_train['load'])
        results = skTree.predict(sk_test[features])
        maes.append(bt.MAE(sk_test['load'].values,results))
        rmse.append(bt.RMSE(sk_test['load'].values,results))
        r2.append(bt.R2(sk_test['load'].values,results))
        depth.append(i)
    sk_tables = pd.DataFrame(data={'depth': depth,'mae': maes, 'rmse':rmse, 'r2': r2})
    # sk_tables['score'] = np.round(sk_tables[['mae', 'rmse']].mean(1)/100,2)
    sk_tables.set_index('depth')
    
    print("Best scores : ")
    best = pd.concat([sk_tables[['mae', 'rmse']].min(0), sk_tables[['r2']].max(0)])
    best_idx = pd.concat([sk_tables[['mae', 'rmse']].idxmin(0) +1, sk_tables[['r2']].idxmax(0) +1])
    final = pd.concat([best,best_idx],1).rename(columns = {0:'best score', 1:"depth"})
    print(final)
                       
    
    
    return sk_tables


def random_forest_grid(data_train, data_test, metric='mae', max_depth=10, max_n=10, exog = None):
    depth=[]
    grid=[]
    
    sk_train = bt.get_features_from_index(data_train)
    sk_test = bt.get_features_from_index(data_test) #predict on 2 weeks
    features = ['hour', 'day', 'month', 'year'] +  exog if exog else ['hour', 'day', 'month', 'year']

    def compute_metric(results):
        if metric=='mape':
            return bt.MAPE(sk_test['load'].values,results)
        if metric == 'rmse':
            return bt.RMSE(sk_test['load'].values,results)
        if metric == 'r2':
            return round(bt.R2(sk_test['load'].values,results),3)
        return bt.MAE(sk_test['load'].values,results)
    
    def get_best(df, metric):
        return df.max() if metric =='r2' else df.min()
    
    def get_best_id(df, metric):
        return df.idxmax() if metric =='r2' else df.idxmin()
    
    for i in range(2,max_n): # on fait varier la taille de la forêt
        metrics=[]
        for j in range(1,max_depth): # on fait varier la profondeur
        #     print('Training scikit Random Forest Regressor with a depth of ', i)
            # TO DO :  handling of exog features !!!
            skForest = RandomForestRegressor(n_estimators=i, criterion = 'mse', max_depth=j, random_state=0, bootstrap=True)
            skForest.fit(sk_train[features], sk_train['load'])
            results = skForest.predict(sk_test[features])
            metrics.append(compute_metric(results))
        grid.append(metrics)
    
    depths = ['depth: ' +str(k) for k in np.arange(1,max_depth)]
    skforest_tables = pd.DataFrame(grid, columns = depths, index = np.arange(2,max_n))
    # skforest_tables['score'] = np.round(skforest_tables[['mae', 'rmse']].mean(1)/100,2)
    skforest_tables.index.name = "n_estimators"
    
    final = pd.concat([get_best(skforest_tables, metric),get_best_id(skforest_tables, metric)],1).rename(columns={0:'best score', 1:'n_estimators'})
    print(final)
    best_depth = get_best_id(final['best score'], metric)
    print("\n Best parameters for Random Forest Regressor : \n {} \n n_estimators :{}".format(best_depth, final.loc[best_depth].values[1]))
    
    return skforest_tables
