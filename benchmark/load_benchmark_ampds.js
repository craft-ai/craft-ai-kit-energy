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


// const TRAIN_DATASET_PATH = path.join(__dirname, "./data/ampds_power.csv");
const DATA_PATH = path.join(__dirname, "./data/ampds_power_30T.csv")
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
            }
        }
    }
  ]
})

.then((kit) => {
    return kit.loadEndpoint(
    {
        id: 'ampds_power_temp',
        metadata: {
        // region: 'Delhi',
        // latitude: 28.544494,  // Location of Indraprastha Institute of Information Technology, Delhi
        // longitude: 77.2642364   // Latitude and longitude retrieved from https://www.latlong.net
        region: 'British Columbia',
        latitude: 49.249444,  // We consider a location in Essonne (France), near the dataset authors' workplace
        longitude: -122.979722
      },
        time_quantum:30*60
    },
    false // True or False = recreation of the endpoint's agent.
    )
    // utils.js dateparser a été modifié pour insérer zone: Asia/Kolkata, à changer si besoin & adapter à timestamp ou ISO Date
    .then((endpoint) => {
        log('Updating the endpoint with 2 years of train data ... ');
        return endpoint.update(DATA_PATH, {
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
        .computePredictions(DATA_PATH, {
          import: {
            from: args['start_pred'] || 72,
            to: parseInt(args['stop_pred'] || 85),
            columns: ['date']
          }
        })
        .then((predictions)=>{
            // console.log(JSON.stringify(predictions))
            // console.log(Object.entries(predictions))

            // // to print predictions
            // predictions.forEach(function(item,index,array){
            //     console.log('........')
            //     for (let property in item){
            //         console.log(property, ':', item[property])
            //     }
            // })

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
  })
