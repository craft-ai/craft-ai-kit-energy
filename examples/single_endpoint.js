require('dotenv').load();

const EnergyKit = require('../src');
const PublicHolidayProvider = require('../src/providers/public_holiday');
const SchoolHolidaysProvider = require('../src/providers/school_holidays');
const debug = require('debug');
const path = require('path');

const log = debug('craft-ai:kit-energy:examples:single_endpoint');
log.enabled = true;

const DATASET_PATH = path.join(__dirname, './data/uci_household_power_consumption.csv');

const interpreter = EnergyKit.craftai.interpreter;

log('Initializing the energy kit...');
EnergyKit.initialize({
  token: process.env.CRAFT_TOKEN,
  providers: [
    {
      provider: PublicHolidayProvider,
      options: { country: 'fr' }
    },
    {
      provider: SchoolHolidaysProvider,
      options: { country: 'fr' }
    }
  ]
})
  .then((kit) => {
    return kit.loadEndpoint({
      id: 'single_endpoint_global',
      metadata: {
        region: '91'
      }
    })
      .then((endpoint) => {
        endpoint.destroy();
        return kit.loadEndpoint({
          id: 'single_endpoint_global',
          metadata: {
            region: '91'
          }
        });
      });
  })
  .then((endpoint) => {
    return endpoint.update(DATASET_PATH, {
      import: {
        from: 0, // Sending the first 6 months of data
        to: 240878
      }
    });
  })
  .then((endpoint) => {
    const pastDay1 = new Date('2007-05-24');
    const pastDay2 = new Date('2007-05-31');

    log(`Computing anomalies between ${pastDay1} and ${pastDay2}`);
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
        log(`${anomalies.values.length} anomalies found over ${anomalies.recordsCount} records`);
        log(anomalies);
      })
      .then(() => {
        log(`Computing report between ${pastDay1} and ${pastDay2}`);
        return endpoint.computeReport({
          from: pastDay1,
          to: pastDay2
        })
          .then(({ average }) => {
            const { actualLoad, predictedLoad, predictedStandardDeviation } = average;
            log(`Average load over the period was ${actualLoad.toFixed(2)} kW, predicted average was ${predictedLoad.toFixed(2)}±${predictedStandardDeviation.toFixed(2)} kW (mean ± SD)`);
          });
      })
      .then(() => {
        const futureDate = new Date('2007-06-21T08:30:00+02:00');
        log(`Predicting load at ${futureDate}`);
        return endpoint.computePredictions([
          { date: futureDate }
        ])
          .then(([prediction]) => {
            const { decisionRules, predictedLoad, date, standardDeviation } = prediction;
            const formatedRules = interpreter.formatDecisionRules(interpreter.reduceDecisionRules(decisionRules));
            log(`Predicted load at ${date} is ${predictedLoad.toFixed(2)}±${standardDeviation.toFixed(2)} kW (mean ± SD) because ${formatedRules}`);
          });
      });
  })
  .then(() => {
    log('Success');
  })
  .catch((err) => {
    log('Error!', err);
  });

