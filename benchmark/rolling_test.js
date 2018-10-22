const debug = require('debug');

const log = debug('craft-ai:kit-energy:benchmark:simul:rolling');
log.enabled = true;

const [START, STOP, TRAIN_STOP, FUTURE_SIZE ] = [1,20,5,5]


const DEPTHS = [5,6]
console.log(START, TRAIN_STOP, STOP, FUTURE_SIZE)


function endpointPipeline(agent_id, last){
    return new Promise((resolve)=>{
        setTimeout(function(){
            resolve("resolved") 
            log("endpoint pipeline done for", agent_id, 'last = ', last); 
        }, 3000);
    }) 


}

async function rolling_pred (agent_id, depth, start, train_stop, stop, future_size){
    let last = train_stop + future_size
    while (last <= stop){
      console.log('launching pipeline for agent_id', agent_id, "train_stop", train_stop, 'last = ', last)
      const baba = await endpointPipeline(agent_id, last)
      console.log(baba)
      last += future_size;
      train_stop += future_size;
    }
  }
  
  DEPTHS.forEach(depth=>{
    const agent_id = "uci_power_" +  depth.toString()
    log(`Launching rolling predictions for depth ${depth}`);
    rolling_pred(agent_id, depth, start=START, train_stop=TRAIN_STOP, stop=STOP, future_size=FUTURE_SIZE)
    
  })
