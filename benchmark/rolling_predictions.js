require('dotenv').config();
const args = require('minimist')(process.argv.slice(2));
const debug = require('../node_modules/debug/src');
const EnergyKit = require('../src');
const fs = require('fs');
const path = require('path');
const WeatherProvider = require('../src/providers/weather');
const { endpointPipeline } = require('./endpoint_pipeline');

const log = debug('craft-ai:kit-energy:benchmark:uci:rolling_preds');
log.enabled = true;

const DATASET_PATH = path.join(__dirname, './data/uci/uci_household_power_consumption.csv');
const [DEPTH, PRED_SIZE, START, INIT, STOP] = [args['depth'],  args['delta'], args['start'],  args['init'], args['stop']];
const WEATHER_CACHE_PATH = path.join(__dirname, './provider/weather_cache_uci.json');
const AGENT_ID = 'uci_'+DEPTH.toString();

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
                size:245280,
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

let kit = EnergyKit
    .initialize({
    token: process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN,
    providers: providers
    })

async function rolling_pred (agent_id, depth, start_train, start_pred, stop, pred_size){
    const first_pred = start_pred;
    let last_pred = start_pred + pred_size;
    const options = {agent_id, depth, providers}
    while (last_pred <= stop){
            const indexes = [start_train, start_pred, last_pred];
            kit = await endpointPipeline(kit, DATASET_PATH, indexes, options)
            last_pred += pred_size;
            start_pred += pred_size;
            log(`Depth ${depth}, Agent ${agent_id}, ${Math.trunc((last_pred-first_pred)/(stop-first_pred)*100)} % done`);
    }
    log(`Agent ${agent_id} : Stop date reached : no more predictions to compute`)
    return kit
}

rolling_pred(AGENT_ID, DEPTH, START*PRED_SIZE, INIT*PRED_SIZE, STOP*PRED_SIZE, PRED_SIZE)
.catch(error => {
    log('Error: rolling predictions interrupted. See error message above. Closi');
    return process.exit(1)

});
