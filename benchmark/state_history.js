require('dotenv').config();
const args = require('minimist')(process.argv.slice(2));
const debug = require('../node_modules/debug/src');
const EnergyKit = require('../src');
const fs = require('fs');
const path = require('path');
const WeatherProvider = require('../src/providers/weather');
const { endpointPipeline } = require('./endpoint_pipeline');
const craftai = require('craft-ai').createClient;

const log = debug('craft-ai:kit-energy:benchmark:rolling_preds');
log.enabled = true;

const DATASET_PATH = path.join(__dirname, './data/uci/uci_household_power_consumption.csv');
const WEATHER_CACHE_PATH = path.join(__dirname, './provider/weather_cache_uci.json');

const client = craftai(process.env.CRAFT_AI_TOKEN);
const AGENT_ID = 'ampds_7'

client.getAgentContextOperations(
    AGENT_ID, // The agent id
  )
  .then(function(operations) {
    let writeStream = fs.createWriteStream(AGENT_ID+'_context_operations.json');
    writeStream.write(JSON.stringify(operations), 'utf8');
    writeStream.on('finish', () => {  
        log('operations saved');
    });
    // close the stream
    writeStream.end();
  })
  .catch(function(error) {
    console.log(error)
  })

