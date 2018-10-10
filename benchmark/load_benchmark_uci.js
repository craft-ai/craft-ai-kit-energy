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

const log = debug('craft-ai:kit-energy:benchmark:uci');
log.enabled = true;

const DATASET_PATH = path.join(__dirname, './data/uci_household_power_consumption.csv');
const WEATHER_CACHE_PATH = path.join(__dirname, './data/weather_cache_uci.json');
//file to save predictions 
const PREDICTIONS_SAVE_FILE_PATH = path.join(__dirname, 'uci_results.json');
const args = require('minimist')(process.argv.slice(2));
const MAX_TREE_DEPTH = args['depth'] || 6 
const AGENT_ID = "uci_power_" +  MAX_TREE_DEPTH
const [TRAIN_START, PREDICTION_START, PREDICTION_STOP] = [args['start_train'], args['start_pred'], args['stop_pred']]
console.log(TRAIN_START, PREDICTION_START, PREDICTION_STOP, 'agent id', AGENT_ID)

log("Retrieving prediction date ")
csv.stream(DATASET_PATH)
    .slice(PREDICTION_START,PREDICTION_START+1)
    .observe(event => {event})
    .then(event=>{
      const PREDICTION_DATE = event.date;

      log('Initializing the energy kit...');
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
            id: AGENT_ID,
            metadata: {
              region: '91',
              latitude: 48.458570,  // We consider a location in Essonne (France), near the dataset authors' workplace
              longitude: 2.156942   // Latitude and longitude retrieved from https://www.latlong.net
            },
            learning:{
              time_quantum:15*60,
              tree_max_depth: MAX_TREE_DEPTH
            },
          },
          false // True or False = recreation of the endpoint's agent.
          )
          .then((endpoint) => {
              log('Updating the endpoint with the training data ... ');
              return endpoint.update(DATASET_PATH, {
                import: {
                  from: TRAIN_START || 1,
                  to: PREDICTION_STOP || 72,
                  columns: ['date', 'load']
                }
              });
            })
          .then((endpoint) => {
              log('Computing predictions from ', PREDICTION_DATE );
              return endpoint
              .retrieveRecords(PREDICTION_DATE)
              .then((records) => endpoint.computePredictions(records, null, PREDICTION_DATE))
              .then((predictions)=>{
                  let data = JSON.stringify(predictions);  
                  fs.appendFileSync(PREDICTIONS_SAVE_FILE_PATH, data); 
                  console.log(data)
              })
            })
          .then(() => kit.close())
          .catch((error) => {
            kit.close();
            throw error;
          })
          .then(()=>process.exit());
        })
    });
    


