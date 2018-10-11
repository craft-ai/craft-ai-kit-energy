require('dotenv').config();
const { endpointPipeline } = require('./load_benchmark_uci');
const path = require('path');

const DATASET_PATH = path.join(__dirname, './data/uci_household_power_consumption.csv');
const args = require('minimist')(process.argv.slice(2));

// const { execFile } = require('child_process');

const debug = require('debug');
const log = debug('craft-ai:kit-energy:benchmark:rolling_preds');
log.enabled = true;

const [START, STOP, TRAIN_STOP, FUTURE_SIZE ] = [args['start'], args['stop'], args['init'], args['future_size']]

const DEPTHS = [5,6,7,8,9,10,11,12]
const LAST = TRAIN_STOP; 
console.log()
let child_args = []
console.log(START, TRAIN_STOP, STOP, FUTURE_SIZE)

function rolling_pred (agent_id, depth, start, train_stop, stop, future_size){
  let last = train_stop + future_size
  while (last <= stop){
    const indexes = [start, train_stop, last]
    endpointPipeline(DATASET_PATH, indexes, {agent_id, depth})
    log(`Depth ${depth}, ${Math.round((last-TRAIN_STOP)/(STOP-TRAIN_STOP)*100)} % done`);
    last += future_size;
    train_stop += future_size;
  }
}

DEPTHS.forEach(depth=>{
  const agent_id = "uci_power_" +  depth.toString()
  log(`Launching rolling predictions for depth ${depth}`)
  rolling_pred(agent_id, depth, start=START, train_stop=TRAIN_STOP, stop=STOP, future_size=FUTURE_SIZE)
})


  // child_args = ['load_benchmark_uci','--depth', depth.toString(), '--stop_train', train_stop.toString(), '--stop_pred', last.toString()];
//   const child = execFile('node', child_args, (error, stdout, stderr) => {
//     if (error) {
//       throw error;
//     }
// });