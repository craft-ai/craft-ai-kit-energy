require('dotenv').load();

const EnergyKit = require('../src');

const debug = require('debug');
const fs = require('fs');
const path = require('path');
const test = require('ava');

const log = debug('craft-ai:kit-energy:test:integration');
log.enabled = true;

test('computes rolling predictions for ampds2 dataset', (t) => {
  return t.notThrowsAsync(rolling_predictions(ampds.definition, undefined, AMPDS_DATASET_PATH, { import: { to: PERIOD } })
    .then((results) =>
      t.snapshot(results)));
});

test('computes rolling predictions for uci dataset', (t) => {
  return rolling_predictions(uci.definition, uci.providers, UCI_DATASET_PATH, { import: { to: PERIOD } })
    .then((results) =>
      t.snapshot(results));
});

async function rolling_predictions(definition, providers, records, options) {
  log('Initializing the energy kit...');
  return EnergyKit.initialize({
    token: process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN,
    recordBulkSize: 5000,
    providers
  })
    .then((kit) => {
      /*
      * Don't force the recreation of the agent, the completion of
      * computations can require several test runs on the same agent
      */
      return kit.loadEndpoint(
        definition,
        false)
        .then((endpoint) => {
          log('Updating the endpoint ...');
          return endpoint
            .update(records, options);
        })
        .then((endpoint) => {
          log('Evaluating the endpoint ...');
          return endpoint.evaluate()
            .then((results) => {
              kit.close();
              return results.map((report) => {
                delete report.values;
                return report;
              });
            });
        })
        .then((results) => {
          log(`predictions computed for agent ${definition.id}`);
          return results;

        })
        .catch((error) => {
          log('Computation failed, closing the kit');
          kit.close();
          console.error(error);
        });
    });
}

const AMPDS_DATASET_PATH = path.join(__dirname, '../examples/data/ampds2.csv');
const UCI_DATASET_PATH = path.join(__dirname, '../examples/data/uci_household_power_consumption.csv');
const UCI_WEATHER_CACHE_PATH = path.join(__dirname, '../examples/data/weather_cache.json');
const PERIOD = 0.5 * 365 * 24 * 60; // To update the endpoints with ~ 6 months of data
const PublicHolidayProvider = require('../src/providers/public_holiday');
const SchoolHolidaysProvider = require('../src/providers/school_holidays');
const WeatherProvider = require('../src/providers/weather');


const ampds = {
  definition: {
    id: 'ampds_endpoint',
    learning: {
      properties: { temperature: { type : 'continuous' } }
    },
    metadata: {
      latitude: 49.249444,  // We consider a location in Burnaby (Canada)
      longitude: -122.979722,  // Latitude and longitude retrieved from https://www.latlong.net
      zone : 'Canada/Pacific'
    }
  }
};

const uci = {
  definition: {
    id: 'uci_endpoint',
    metadata: {
      region: '91',
      latitude: 48.458570,  // We consider a location in Essonne (France), near the dataset authors' workplace
      longitude: 2.156942,   // Latitude and longitude retrieved from https://www.latlong.net
      zone : 'Europe/Paris'
    }
  },
  providers: [
    {
      provider: PublicHolidayProvider,
      options: { country: 'fr' }
    },
    {
      provider: SchoolHolidaysProvider,
      options: { country: 'fr' }
    },
    {
      provider: WeatherProvider,
      options: {
        token: process.env.DARK_SKY_TOKEN || 'fake-token-everything-should-be-in-cache',
        cache: {
          load: () => require(UCI_WEATHER_CACHE_PATH),
          save: (cache) => {
            fs.writeFileSync(
              UCI_WEATHER_CACHE_PATH,
              JSON.stringify(cache, null, '  ')
            );
          }
        }
      }
    }
  ]
};
