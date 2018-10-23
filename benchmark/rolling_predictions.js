require('dotenv').config();
const EnergyKit = require('../../../craft-ai-kit-energy/src');
const args = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const path = require('path');
const debug = require('../../../craft-ai-kit-energy/node_modules/debug/src');
const util = require('util');
const WeatherProvider = require('../../../craft-ai-kit-energy/src/providers/weather');
const { endpointPipeline } = require('./endpoint_pipeline');

const log = debug('craft-ai:kit-energy:benchmark:rolling_preds');
log.enabled = true;
// const WEATHER_CACHE_PATH = path.join(__dirname, './provider/weather_cache_cedar.json');
let WEATHER_CACHE_PATH;

const DATASET_PATH = path.join(__dirname, '../data/cedar/cedar_325367.csv');
const save_file_path = path.join(__dirname, '../preds/cedar_325772_periodic_results.json');
const PRED_SIZE =  7*24*4
let dataset_path;
let agent_id;
let kit;
const exog = ['day_of_period']
// const METERS = ['2238','325546', '325607', '326306']
// const METERS = ['2238']
// const DEPTHS = [6,8,6,6]
// const DEPTHS = [6]
const periodic = [true]

// const start_train_indexes = [44807, 3664, 1, 3668]

const [DEPTH, START, INIT, STOP] = [args['depth'],  args['start'],  args['init'], args['stop']]
const start_train_indexes = [START]
// const start_pred_indexes = [167,106,86,106].map(el=>el*PRED_SIZE)
const start_pred_indexes = [INIT].map(el=>el*PRED_SIZE)
// const stop_train_indexes = [216,157,137,157].map(el=>el*PRED_SIZE)
const stop_train_indexes = [STOP].map(el=>(el+1)*PRED_SIZE)


// const [START, INIT, STOP, PRED_SIZE ] = [args['start'],  args['init'], args['stop'], args['step']]
// console.log(START, STOP, INIT, PRED_SIZE)

let providers;

kit = EnergyKit
    .initialize({
    token: process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN || process.env.CRAFT_AI_TOKEN_AZURE,
    providers: providers
    })

async function rolling_pred (agent_id, depth, providers, start_train, start_pred, stop, pred_size, periodic){
    const init = start_train
    console.log('periodic ?', periodic)
    const options = periodic? {agent_id, depth, providers, exog} : {agent_id, depth, providers}
    console.log(options)
    // TO CHANGE : VERY BAD, DOES NOT HANDLE 2 FIGURED DEPTH NUMBERS // 
    let dataset_path =  path.join(__dirname, '../data/cedar/'+agent_id.slice(0, agent_id.length-2)+'.csv')
    console.log(dataset_path)
    let last_pred = start_pred + pred_size
    while (last_pred <= stop){
            const indexes = [start_train, start_pred, last_pred];
            kit = await endpointPipeline(kit, dataset_path, indexes, options )
            last_pred += pred_size;
            start_pred += pred_size;
            log(`Depth ${depth}, Agent ${agent_id}, ${Math.trunc((last_pred-init)/(stop-init)*100)} % done`);
        
    }
    log(`Agent ${agent_id} : Stop date reached : no more predictions to compute`)
    return kit
}

function bench(meters, depths){
    

    return Promise.all(
        meters.map((meter,idx)=>{
            WEATHER_CACHE_PATH = path.join(__dirname, '../data/provider/weather_cache_cedar.json');
            providers = [ 
                {
                    provider: WeatherProvider,
                    options:{
                        // token: "j-utilise-le-cache",
                        token: process.env.DARK_SKY_TOKEN,
                        properties: ['temperature'],
                        refresh: 'hourly',
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

            let kits =
                periodic.map(period => {
                    depth = depths[idx]
                    agent_id = period ? "cedar_"+meter+"_periodic_"+depth.toString() : "cedar_"+meter+'_'+depth.toString()
                    log(`Launching rolling predictions for  ${agent_id}`);
                    return rolling_pred(agent_id, depth, providers, 
                        start_train=start_train_indexes[idx], 
                        start_pred=start_pred_indexes[idx], 
                        stop=stop_train_indexes[idx] +1, pred_size=PRED_SIZE,
                        period)
                })
            return Promise.all(kits)
            .catch((err)=>{
                console.log(err)
                })
    }))
    .then(kits => {
        kits[0][0].close()
        log("Benchmark done")
    })
    .catch((error)=>{
        console.log(error)

    })
}

bench([METER], [DEPTH])