require('dotenv')
  .config();

const debug = require('debug');
const EnergyKit = require('../src');
const fs = require('fs');
const path = require('path');
const PublicHolidayProvider = require('../src/providers/public_holiday');
const SchoolHolidaysProvider = require('../src/providers/school_holidays');
const WeatherProvider = require('../src/providers/weather');

const log = debug('craft-ai:kit-energy:examples:single_endpoint');
log.enabled = true;

const DATASET_PATH = path.join(__dirname, './data/uci_household_power_consumption.csv');
const WEATHER_CACHE_PATH = path.join(__dirname, './data/weather_cache.json');

const interpreter = EnergyKit.craftai.interpreter;

log('Initializing the energy kit...');
EnergyKit.initialize({
  token: process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN,
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
})
  .then((kit) => {
    return kit.loadEndpoint(
      {
        id: 'single_endpoint_global',
        metadata: {
          region: '91',
          latitude: 48.458570,  // We consider a location in Essonne (France), near the dataset authors' workplace
          longitude: 2.156942   // Latitude and longitude retrieved from https://www.latlong.net
        }
      },
      true // For the purpose of this test we force the recreation of the endpoint's agent.
    )
      .then((endpoint) => {
        log('Updating the endpoint with ~6 months of data...');
        return endpoint.update(DATASET_PATH, {
          import: {
            from: 0,
            to: 240878
          }
        });
      })
      .then((endpoint) => {
        const pastDay1 = new Date('2007-05-24');
        const pastDay2 = new Date('2007-05-31');

        log(`Computing anomalies between ${pastDay1} and ${pastDay2}...`);
        return endpoint
          .computeAnomalies(
            {
              from: pastDay1,
              to: pastDay2
            },
            {
              minConfidence: 0.6
            }
          )
          .then((anomalies) => {
            log(`${anomalies.values.length} anomalies found over ${anomalies.recordsCount} records.`);
            log(anomalies);
          })
          .then(() => {
            log(`Computing report between ${pastDay1} and ${pastDay2}...`);
            return endpoint.computeReport({
              from: pastDay1,
              to: pastDay2
            })
              .then(({ average }) => {
                const { actualLoad, predictedLoad, predictedStandardDeviation } = average;
                log(`Average load over the period was ${actualLoad.toFixed(2)} kW, predicted average was ${predictedLoad.toFixed(2)}±${predictedStandardDeviation.toFixed(2)} kW (mean ± SD).`);
              });
          })
          .then(() => {
            const futureDate = new Date('2007-06-21T08:30:00+02:00');
            log(`Predicting load at ${futureDate}...`);
            return endpoint.computePredictions([
              { date: futureDate }
            ])
              .then(([prediction]) => {
                const { decisionRules, predictedLoad, date, standardDeviation } = prediction;
                const formatedRules = interpreter.formatDecisionRules(interpreter.reduceDecisionRules(decisionRules));
                log(`Predicted load at ${date} is ${predictedLoad.toFixed(2)}±${standardDeviation.toFixed(2)} kW (mean ± SD) because ${formatedRules}.`);
              });
          });
      })
      .then(() => kit.close())
      .catch((error) => {
        kit.close();
        throw error;
      });
  })
  .then(() => {
    log('Success');
  })
  .catch((error) => {
    log('Error!', error);
  });
