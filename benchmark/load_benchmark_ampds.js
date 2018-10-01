require('dotenv').config();
const EnergyKit = require('../src');
const parse = require('csv-parse')
const path = require('path');
const debug = require('debug');
const util = require('util');
const fs = require('fs');
const WeatherProvider = require('../src/providers/weather');

const interpreter = EnergyKit.craftai.interpreter;

const log = debug('load_benchmark');
log.enabled = true;
const args = require('minimist')(process.argv.slice(2));
//  Step 1 : construct weather provider
// Step 2 : construct endpoint
// Step 3 :  feed load data
// Step 3 : compute predictions ! 

// Then :
// Add holidays provider ...


const TRAIN_DATASET_PATH = path.join(__dirname, "./data/ampds_power_30T.csv");
const PREDICTIONS_STATES_PATH = path.join(__dirname, "./data/ampds_power_30T_states.csv");
const WEATHER_CACHE_PATH = path.join(__dirname, './provider/weather_cache_ampds.json');
//file to save predictions 
const PREDICTIONS_SAVE_FILE_PATH = path.join(__dirname, 'ampds_predictions_temp.json');

log('Initializing the energy kit...');
EnergyKit
.initialize({
  token: process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN,
  providers: [
    {
        provider: WeatherProvider,
        options:{
            token: "j-utilise-le-cache",
            // token: process.env.DARK_SKY_TOKEN,
            properties: ['temperature'],
            // refresh: 'hourly',
            cache: {
                load: () => require(WEATHER_CACHE_PATH),
                // save: (cache) => {
                //   fs.writeFileSync(
                //     WEATHER_CACHE_PATH,
                //     JSON.stringify(cache, null, '  ')
                //  );
                // }
                size:35040
            }
        }
    }
  ]
})

.then((kit) => {
    return kit.loadEndpoint(
    {
        id: 'ampds_power_bench_test',
        metadata: {
        region: 'British Columbia',
        latitude: 49.249444,  // We consider a location in British Columbia (Canada), near the dataset authors' workplace
        longitude: -122.979722
      },
        time_quantum:30*60
    },
    false // True or False = recreation of the endpoint's agent.
    )
    .then((endpoint) => {
        log('Updating the endpoint with 2 years of train data ... ');
        return endpoint.update(TRAIN_DATASET_PATH, {
          import: {
            from: args['start_train'] || 1,
            to: args['stop_train'] || 72,
            columns: ['date', 'load']
          }
        });
      })
    .then((endpoint) => {
        log('Computing predictions ... ');
        return endpoint
        .computePredictions(PREDICTIONS_STATES_PATH, {
          import: {
            from: args['start_pred'] || 72,
            to: parseInt(args['stop_pred'] || 85),
            columns: ['date']
          }
        })
        .then((predictions)=>{
            let data = JSON.stringify(predictions);  
            // fs.writeFileSync(PREDICTIONS_SAVE_FILE_PATH, data); 
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
