const test = require('ava');
const seedrandom = require('seedrandom');

const EnergyKit = require('../src/index');
const Provider = require('./data/provider');
const Utils = require('./utils');


test.before(require('dotenv').load);
test.beforeEach(Utils.createContext);
test.afterEach.always(Utils.destroyContext);


test('fails initializing a kit with invalid providers', (t) => {
  const INVALID_ARRAYS = [null, 0, true, 'string', Symbol(), new Uint8Array(10)];

  return Promise.all(INVALID_ARRAYS
    .concat(INVALID_OBJECTS.map((value) => [value]))
    .concat(INVALID_OBJECTS.map((value) => [{ provider: value }]))
    .map((value) => t.throws(EnergyKit.initialize({ providers: value }))));
});

test('uses a provider to extend records', async(t) => {
  await Utils.createContext(t, { providers: [Provider] });

  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(RECORDS))
    .then((endpoint) => endpoint
      .retrieveRecords()
      .then((history) => {
        t.true(Array.isArray(history));
        t.is(history.length, RECORDS.length);
        t.true(isExtended(history));

        t.snapshot(history);
      }));
});

test('uses a provider with options to extend records', async(t) => {
  await Utils.createContext(t, {
    providers: [{
      provider: Provider,
      options: { random: seedrandom('weather') }
    }]
  });

  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register(), metadata: { averageMin: 15, averageMax: 24 } })
    .then((endpoint) => endpoint.update(RECORDS))
    .then((endpoint) => endpoint
      .retrieveRecords()
      .then((history) => {
        t.true(Array.isArray(history));
        t.is(history.length, RECORDS.length);
        t.true(isExtended(history));

        t.snapshot(history);
      }));
});


function isExtended(history) {
  return history
    .map((record) => Object.keys(record))
    .every((keys) => FEATURES.every((key) => keys.includes(key)));
}


const FEATURES = Provider.FEATURES;
const INVALID_OBJECTS = Utils.INVALID_OBJECTS;
const RECORDS = Utils.RECORDS.slice(0, 500);
