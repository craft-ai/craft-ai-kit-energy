const test = require('ava');

const Constants = require('../../src/constants');
const Helpers = require('../helpers');


test.before(require('dotenv').load);
test.beforeEach(Helpers.createEndpointContext);
test.afterEach.always(Helpers.destroyEndpointContext);


test('fails retrieving the records\' history of an endpoint with invalid paramaters', (t) => {
  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => Promise.all(INVALID_DATES.map((date) => Promise.all([
      t.throwsAsync(endpoint.retrieveRecords(date)),
      t.throwsAsync(endpoint.retrieveRecords(undefined, date))
    ]))));
});

test('retrieves the records\' history of an endpoint', (t) => {
  const context = t.context;
  const kit = context.kit;

  // Generate a non-empty random window on the history
  const length = RECORDS.length;
  const middle = Math.floor(length / 2);
  const firstIndex = context.random(middle);
  const secondIndex = middle + context.random(middle);
  const start = RECORDS[firstIndex][DATE];
  const end = RECORDS[secondIndex - 1][DATE];

  return t.notThrowsAsync(kit
    .loadEndpoint({ id: t.context.endpoint.register() })
    .then((endpoint) => endpoint
      .retrieveRecords()
      .then((history) => {
        t.true(Array.isArray(history));
        t.is(history.length, 0);

        return endpoint.update(RECORDS);
      }))
    .then((endpoint) => Promise.all([
      endpoint.retrieveRecords(),
      endpoint.retrieveRecords(start),
      endpoint.retrieveRecords(null, end),
      endpoint.retrieveRecords(start, end),
    ]))
    .then((values) => {
      values.forEach((history) => t.true(Array.isArray(history)));
      t.is(values[0].length, length);
      t.is(values[1].length, length - firstIndex);
      t.is(values[2].length, secondIndex);
      t.is(values[3].length, secondIndex - firstIndex);
      t.deepEqual(values[0].map((record) => ({ ...record, date: record[DATE].toISOString() })), RECORDS);
      t.deepEqual(values[1], values[0].slice(firstIndex));
      t.deepEqual(values[2], values[0].slice(0, secondIndex));
      t.deepEqual(values[3], values[1].slice(0, secondIndex - firstIndex));
      t.snapshot(values[0]);
    }));
});

test('fails retrieving the predictive model of an endpoint with invalid paramaters', (t) => {
  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => Promise.all(INVALID_DATES.map((date) => t.throwsAsync(endpoint.retrievePredictiveModel(date)))));
});

test('retrieves the predictive model of an endpoint', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrowsAsync(kit
    .loadEndpoint({ id: t.context.endpoint.register(), metadata: { zone: 'Europe/Paris' } })
    .then((endpoint) => endpoint
      .update(RECORDS)
      .then(() => Promise.all([
        endpoint.retrievePredictiveModel(),
        endpoint.retrievePredictiveModel(RECORDS[RECORDS.length - 1][DATE]),
      ])))
    .then((values) => {
      values.forEach((predictiveModel) => t.true(Helpers.isPredictiveModel(predictiveModel)));
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});


const DATE = Constants.DATE_FEATURE;
const RECORDS = Helpers.RECORDS;
const INVALID_DATES = Helpers.INVALID_DATES;
