const test = require('ava');
const seedrandom = require('seedrandom');

const Constants = require('../src/constants');
const EnergyKit = require('../src/index');
const Helpers = require('./helpers');
const Is = require('./helpers/is');
const Provider = require('./helpers/provider');


test.before(require('dotenv').load);
test.afterEach.always(Helpers.destroyEndpointContext);


test('fails initializing a kit with invalid providers', (t) => {
  return Promise.all(INVALID_ARRAYS
    .concat(INVALID_OBJECTS.map((value) => [value]))
    .concat(INVALID_OBJECTS.map((value) => [{ provider: value }]))
    .map((value) => t.throwsAsync(EnergyKit.initialize({ providers: value }))));
});

test('uses a provider to extend records', async(t) => {
  await Helpers.createEndpointContext(t, { providers: [Provider] });

  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register(), metadata: { zone: 'Europe/Paris' } })
    .then((endpoint) => endpoint.update(RECORDS))
    .then((endpoint) => endpoint.retrieveRecords())
    .then((history) => removeTimezones(history))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS.length);
      t.true(isExtended(history));
      
      t.snapshot(history);
    });
});

test('uses a provider with options to extend records', async(t) => {
  await Helpers.createEndpointContext(t, {
    providers: [{
      provider: Provider,
      options: { random: seedrandom('weather') }
    }]
  });

  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register(), metadata: { averageMin: 15, averageMax: 24, zone: 'Europe/Paris' } })
    .then((endpoint) => endpoint.update(RECORDS))
    .then((endpoint) => endpoint.retrieveRecords())
    .then((history) => removeTimezones(history))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS.length);
      t.true(isExtended(history));

      t.snapshot(history);
    });
});

test('uses a provider to compute predictions', async(t) => {
  await Helpers.createEndpointContext(t, { providers: [Provider] });

  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register(), metadata: { zone: 'Europe/Paris' } })
    .then((endpoint) => endpoint.update(RECORDS))
    .then((endpoint) => endpoint.computePredictions(STATES))
    .then((predictions) => {
      t.true(Array.isArray(predictions));
      t.is(predictions.length, STATES.length);
      t.true(Is.predictions(predictions));

      t.snapshot(predictions);
    });
});


function isExtended(history) {
  return history
    .map((record) => Object.keys(record))
    .every((keys) => FEATURES.every((key) => keys.includes(key)));
}

function removeTimezones(history) {
  return history
    .map((record) => { 
      delete record.timezone; 
      return record;
    });
}

const DATE = Constants.DATE_FEATURE;
const FEATURES = Provider.FEATURES;
const INVALID_ARRAYS = Helpers.INVALID_ARRAYS;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const RECORDS = Helpers.RECORDS.slice(0, 500);
const STATES = Helpers.RECORDS.slice(500, 1000).map((record) => ({ [DATE]: record[DATE] }));
