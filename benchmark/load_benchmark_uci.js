require('dotenv').config();
const EnergyKit = require('../src');
const csv = require('../src/parsers/csv')
const parse = require('csv-parse')
const path = require('path');
const debug = require('debug');
const util = require('util');
const fs = require('fs');
const WeatherProvider = require('../src/providers/weather');

const interpreter = EnergyKit.craftai.interpreter;
const log = debug('craft-ai:kit-energy:benchmark:pipeline');
log.enabled = true;


const WEATHER_CACHE_PATH = path.join(__dirname, './data/weather_cache_uci.json');
//file to save predictions 
// const args = require('minimist')(process.argv.slice(2));
// const MAX_TREE_DEPTH = args['depth'] || 6 
// const [TRAIN_START, PREDICTION_START, PREDICTION_STOP] = [args['start_train'], args['stop_train'], args['stop_pred']]




function get_preds (path){ 
  try{
    const data = require(path);
    return Array.isArray(data)? data : [data];
  }
  catch(error){
    log("no former predictions found in", path)
    return [];
  }
};

function endpointPipeline(path_to_dataset, indexes, {agent_id, tree_max_depth} ){
  

  const [train_start, prediction_start, prediction_stop] = indexes
  const save_file_path = path.join(__dirname, agent_id +'_results.json');
  const former_preds = get_preds(save_file_path);
  const dates = []

  log(`${agent_id} : Retrieving prediction dates`)
  csv.stream(path_to_dataset)
      .slice(prediction_start, prediction_stop)
      .observe(event => dates.push(event))
      .then(events=>{
        const [prediction_start_date , prediction_stop_date] = [dates[0].date, dates[dates.length-1].date]
        log(`${agent_id} : Initializing the energy kit...`);
        EnergyKit
        .initialize({
          token: process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN,
          providers: [
            {
                provider: WeatherProvider,
                options:{
                    // token: "j-utilise-le-cache",
                    token: process.env.DARK_SKY_TOKEN,
                    properties: ['temperatureLow', 'temperatureHigh'],
                    refresh: 'daily',
                    cache: {
                      load: () => require(WEATHER_CACHE_PATH),
                      save: (cache) => {
                        fs.writeFileSync(
                          WEATHER_CACHE_PATH,
                          JSON.stringify(cache, null, '  ')
                        );
                      }            
                    }
                }
            }
          ]
        })
        .then((kit) => {
            return kit.loadEndpoint(
            {
              id: agent_id,
              metadata: {
                region: '91',
                latitude: 48.458570,  // We consider a location in Essonne (France), near the dataset authors' workplace
                longitude: 2.156942   // Latitude and longitude retrieved from https://www.latlong.net
              },
              learning:{
                time_quantum:60,
                tree_max_depth: tree_max_depth
              },
            },
            false // True or False = recreation of the endpoint's agent.
            )
            .then((endpoint) => {
                log(`${agent_id} Updating the endpoint with the training data ... `);
                return endpoint.update(path_to_dataset, {
                  import: {
                    from: train_start || 1,
                    to: prediction_stop || 72,
                    columns: ['date', 'load']
                  }
                });
              })
            .then((endpoint) => {
                log(`${agent_id} : Computing predictions from ${prediction_start_date} to ${prediction_stop_date}`);
                return endpoint
                .retrieveRecords(prediction_start_date , prediction_stop_date)
                .then((records) => endpoint.computePredictions(records, null, prediction_start_date))
                .then((predictions)=>{
                    // console.log('predicted :', predictions);
                    let new_preds = former_preds.concat(predictions)
                    let data = JSON.stringify(new_preds);
                    fs.writeFileSync(save_file_path, data); 

                })
              })
            .then(() => kit.close())
            .catch((error) => {
              kit.close();
              throw error;
            })
            // .then(()=>process.exit());
          })
      });
  }


  module.exports = {
    endpointPipeline
  };