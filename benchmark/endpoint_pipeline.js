require('dotenv').config();
const EnergyKit = require('../src');
const csv = require('../src/parsers/csv')
const parse = require('../node_modules/csv-parse/lib')
const path = require('path');
const debug = require('../node_modules/debug/src');
const util = require('util');
const fs = require('fs');

const log = debug('craft-ai:kit-energy:benchmark:pipeline');
log.enabled = true;

function get_preds (path){ 
  try{
      const data = JSON.parse(fs.readFileSync(path, {encoding:"utf8"}));
      return Array.isArray(data)? data : [data];
  }
  catch(error){
      console.log("no former predictions found in", path)
      return [];
  }
};
async function prediction_dates (agent_id, path_to_dataset, prediction_start, prediction_stop){ 
  console.log(prediction_start, prediction_stop)
  log(`${agent_id} : Retrieving prediction dates`)
  const dates = []
  return csv
        .stream(path_to_dataset)
        .slice(prediction_start, prediction_stop)
        .observe(event => dates.push(event))
        .then(()=>[dates[0].date, dates[dates.length-1].date])
}

function endpointPipeline(kit, path_to_dataset, indexes, {agent_id, depth, providers, exog} ){

  if (exog !=undefined && !Array.isArray(exog)){
    throw (`exog must be an array, received ${typeof exog}`)
  }

  const [train_start, prediction_start, prediction_stop] = indexes
  const save_file_path = path.join(__dirname, './preds/'+agent_id +'_rolling_results.json');
  console.log(train_start, prediction_start, prediction_stop)
  const former_preds = get_preds(save_file_path);
       
  return Promise.all([prediction_dates(agent_id, path_to_dataset, prediction_start, prediction_stop), kit])
              .then(values => {
                // log(`${agent_id} : Energy kit initialized`);
                [[prediction_start_date, prediction_stop_date], kit] = values
                return kit
              })
              .then((kit) => {
                return kit.loadEndpoint(
                {
                  id: agent_id,
                  metadata: {
                    region: '91',
                    latitude: 48.458570,  //Cedar Rapids, Iowa, retrieved from latlong.net
                    longitude: 2.156942   // Latitude and longitude retrieved from https://www.latlong.net
                  },
                  learning:{
                    time_quantum:60,
                    tree_max_depth: depth,
                    properties : exog ? {[exog[0]]: {type : 'enum'}} : undefined
                  },
                },
                false // True or False = recreation of the endpoint's agent.
                )
                .then((endpoint) => {
                  log(`${agent_id} Updating the endpoint with the training data ... `);
                  return endpoint.update(path_to_dataset, {
                    import: {
                      from: train_start || 1,
                      to: prediction_stop + 1 || 72,
                      columns: exog?  ['date', 'load'].concat(exog) : ['date', 'load']
                    }
                  });
                })
                .then((endpoint) => {
                  log(`${agent_id} : To compute predictions from ${prediction_start_date} to ${prediction_stop_date}`);
                  return endpoint
                    .retrieveRecords(prediction_start_date , prediction_stop_date)
                    .then((records) => endpoint.computePredictions(records, null, prediction_start_date))
                    .then((predictions)=>{
                      let new_preds = former_preds.concat(predictions)
                      let data = JSON.stringify(new_preds);
                      return new Promise(resolve=>{
                        let writeStream = fs.createWriteStream(save_file_path);
                        writeStream.write(data, 'utf8');
                        writeStream.on('finish', () => {  
                            log('predictions saved');
                            resolve();
                        });
                        // close the stream
                        writeStream.end();
                      })
                        
                    })
                })
              })
              .then(() => kit)
              .catch((error) => {
                log(agent_id, ' failed, closing the kit')
                console.log(error)
                kit.close();
                throw error;
              });
  }


  module.exports = {
    endpointPipeline
  };