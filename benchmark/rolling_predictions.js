require('dotenv').config();
const args = require('minimist')(process.argv.slice(2));
const debug = require('debug');
const fs = require('fs');

const log = debug('craft-ai:kit-energy:benchmark:rolling_preds');
log.enabled = true;

const { endpointPipeline } = require('./endpoint_pipeline');
const path = require('path');
const WeatherProvider = require('../src/providers/weather');

const DATASET_PATH = path.join(__dirname, './data/uci_household_power_consumption.csv');
const WEATHER_CACHE_PATH = path.join(__dirname, './data/weather_cache_uci.json');

const DEPTHS = [5]
const [START, STOP, INIT, PRED_SIZE ] = [args['start'], args['stop'], args['init'], args['pred_size']]
console.log(START, STOP, INIT, PRED_SIZE)
const providers = [ 
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


async function rolling_pred (agent_id, depth, providers, start_train, start_pred, stop, pred_size){
  let last_pred = start_pred + pred_size
  console.log(start_pred, last_pred, stop)
  while (last_pred <= stop){
    log('entering while loop')
    const indexes = [start_train, start_pred, last_pred]
    await endpointPipeline(DATASET_PATH, indexes, {agent_id, depth, providers})
    log(`Depth ${depth}, ${Math.round((last_pred-INIT)/(STOP-INIT)*100)} % done`);
    last_pred += pred_size;
    start_pred += pred_size;
  }
}

DEPTHS.forEach(depth=>{
  const agent_id = "uci_power_" +  depth.toString()
  log(`Launching rolling predictions for depth ${depth}`);
  // AJOUT TIMEOUT 
  rolling_pred(agent_id, depth, providers, start_train=START, start_pred=INIT, stop=STOP, pred_size=PRED_SIZE)
  
});
