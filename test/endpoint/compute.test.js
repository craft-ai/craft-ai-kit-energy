const path = require('path');
const test = require('ava');

const Constants = require('../../src/constants');
const Helpers = require('../helpers');


test.before(require('dotenv').load);

test.beforeEach((t) => Helpers
  .createEndpointContext(t)
  .then(() => {
    const context = t.context;
    const kit = context.kit;

    return kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(TRAINING_RECORDS))
      .then((endpoint) => t.context.endpoint.current = endpoint);
  }));

test.afterEach.always(Helpers.destroyEndpointContext);


test('fails computing predictions with invalid parameters', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return Promise.all(INVALID_DATES
    .map((date) => t.throws(endpoint.computePredictions([], null, date))));
});

test('fails computing predictions with states not passed in chronological order', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  // Shuffle the states
  const states = context.shuffle(TEST_RECORDS);

  return t.throws(endpoint.computePredictions(states));
});

test('computes predictions', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(Promise
    .all([
      [TEST_RECORDS],
      [Helpers.streamify(TEST_RECORDS)],
      [path.join(__dirname, '../helpers/data/records.csv'), { import: { from: INDEX } }],
    ].map((parameters) => endpoint.computePredictions(...parameters)))
    .then((values) => {
      const predictions = values[0];

      t.true(isPredictions(predictions));
      t.is(predictions.length, TEST_RECORDS.length);

      values.slice(1).forEach((current) => t.deepEqual(predictions, current));
      t.snapshot(predictions);
    }));
});

test('computes predictions given a model', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(endpoint
    .retrievePredictiveModel()
    .then((model) => Promise.all([
      endpoint.computePredictions(TEST_RECORDS),
      endpoint.computePredictions(TEST_RECORDS, null, model),
    ]))
    .then((values) => {
      const predictions = values[0];

      t.true(isPredictions(predictions));
      t.is(predictions.length, TEST_RECORDS.length);

      values.slice(1).forEach((current) => t.deepEqual(predictions, current));
      t.snapshot(predictions);
    }));
});

test('filters out states with invalid date formats', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  const dates = INVALID_DATES.concat([null]);
  const states = TEST_RECORDS
    .slice(0, dates.length)
    .map((state, index) => ({ ...state, [DATE]: dates[index] }));

  return t.notThrows(endpoint
    .computePredictions(states)
    .then((predictions) => {
      t.true(Array.isArray(predictions));
      t.is(predictions.length, 0);
    }));
});

test('merges states with the same date', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  // Add a duplicate state
  const index = context.random(TEST_RECORDS.length - 1);
  const states = [...TEST_RECORDS];

  states.splice(index + 1, 0, { [DATE]: TEST_RECORDS[index][DATE] });

  return t.notThrows(endpoint
    .computePredictions(states)
    .then((predictions) => {
      t.true(isPredictions(predictions));
      // The duplicate state should be omitted
      t.is(predictions.length, TEST_RECORDS.length);
      t.snapshot(predictions);
    }));
});

test('merges partial states until first full state', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  // Add some empty states
  const states = [{}, {}, {}].concat(TEST_RECORDS);

  return t.notThrows(endpoint
    .computePredictions(states)
    .then((predictions) => {
      t.true(isPredictions(predictions));
      // The added empty states should be omitted
      t.is(predictions.length, TEST_RECORDS.length);
      t.snapshot(predictions);
    }));
});

test('fails computing anomalies with invalid parameters', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return Promise.all([[null]]
    .concat(INVALID_OBJECTS.map((records) => [records]))
    .concat(INVALID_OBJECTS.map((options) => [[], options]))
    .concat(INVALID_NUMBERS.map((value) => [[], { minConfidence: value }]))
    .concat(INVALID_NUMBERS.map((value) => [[], { minAbsoluteDifference: value }]))
    .concat(INVALID_NUMBERS.map((value) => [[], { minSigmaDifference: value }]))
    .concat(INVALID_DATES.map((date) => [[], null, date]))
    .map((parameters) => t.throws(endpoint.computeAnomalies(...parameters))));
});

test('fails computing anomalies with records not passed in chronological order', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  // Shuffle the records
  const records = context.shuffle(TEST_RECORDS);

  return t.throws(endpoint.computeAnomalies(records));
});

test('computes anomalies', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(Promise
    .all([
      [TEST_RECORDS],
      [Helpers.streamify(TEST_RECORDS)],
      [path.join(__dirname, '../helpers/data/records.csv'), { import: { from: INDEX } }],
    ].map((parameters) => endpoint.computeAnomalies(...parameters)))
    .then((values) => {
      const anomalies = values[0];

      t.true(isAnomalies(anomalies));
      t.is(anomalies.recordsCount, TEST_RECORDS.length);

      values.slice(1).forEach((current) => t.deepEqual(anomalies, current));
      t.snapshot(anomalies);
    }));
});

test('computes anomalies given a model', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(endpoint
    .retrievePredictiveModel()
    .then((model) => Promise.all([
      [TEST_RECORDS],
      [TEST_RECORDS, null, model],
    ].map((parameters) => endpoint.computeAnomalies(...parameters))))
    .then((values) => {
      const anomalies = values[0];

      t.true(isAnomalies(anomalies));
      t.is(anomalies.recordsCount, TEST_RECORDS.length);

      values.slice(1).forEach((current) => t.deepEqual(anomalies, current));
      t.snapshot(anomalies);
    }));
});

test('computes anomalies from a window', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(endpoint
    .update(RECORDS)
    .then(() => endpoint.retrievePredictiveModel(WINDOW.from))
    .then((model) => Promise.all([
      [WINDOW],
      [WINDOW_RECORDS, null, model],
    ].map((parameters) => endpoint.computeAnomalies(...parameters))))
    .then((values) => {
      const anomalies = values[0];

      t.true(isAnomalies(anomalies));
      t.is(anomalies.recordsCount, WINDOW_LENGTH);

      values.slice(1).forEach((current) => t.deepEqual(anomalies, current));
      t.snapshot(anomalies);
    }));
});

test('filters out anomalies given custom thresholds', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(Promise
    .all([
      [[], {}],
      [TEST_RECORDS, { minConfidence: 1 }],
      [TEST_RECORDS, { minAbsoluteDifference: Infinity }],
      [TEST_RECORDS, { minSigmaDifference: Infinity }],
    ].map((parameters) => endpoint.computeAnomalies(...parameters)))
    .then((values) => values.forEach((anomalies) => {
      t.true(isAnomalies(anomalies));
      t.is(anomalies.values.length, 0);
    })));
});

test('fails computing a report with invalid parameters', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return Promise.all([[null]]
    .concat(INVALID_OBJECTS.map((options) => [[], options]))
    .concat(INVALID_NUMBERS.map((value) => [[], { minConfidence: value }]))
    .concat(INVALID_NUMBERS.map((value) => [[], { minAbsoluteDifference: value }]))
    .concat(INVALID_NUMBERS.map((value) => [[], { minSigmaDifference: value }]))
    .concat(INVALID_DATES.map((date) => [[], null, date]))
    .map((parameters) => t.throws(endpoint.computeReport(...parameters))));
});

test('fails computing a report with records not passed in chronological order', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  // Shuffle the records
  const records = context.shuffle(TEST_RECORDS);

  return t.throws(endpoint.computeReport(records));
});

test('computes a report', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(Promise
    .all([
      [TEST_RECORDS],
      [Helpers.streamify(TEST_RECORDS)],
      [path.join(__dirname, '../helpers/data/records.csv'), { import: { from: INDEX } }],
    ].map((parameters) => endpoint.computeReport(...parameters)))
    .then((values) => {
      const report = values[0];

      t.true(isReport(report));
      t.is(report.recordsCount, TEST_RECORDS.length);

      values.slice(1).forEach((current) => t.deepEqual(report, current));
      t.snapshot(report);
    }));
});

test('computes a report given a model', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(endpoint
    .retrievePredictiveModel()
    .then((model) => Promise.all([
      [TEST_RECORDS],
      [TEST_RECORDS, null, model],
    ].map((parameters) => endpoint.computeReport(...parameters))))
    .then((values) => {
      const report = values[0];

      t.true(isReport(report));
      t.is(report.recordsCount, TEST_RECORDS.length);

      values.slice(1).forEach((current) => t.deepEqual(report, current));
      t.snapshot(report);
    }));
});

test('computes a report from a window', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(endpoint
    .update(RECORDS)
    .then(() => endpoint.retrievePredictiveModel(WINDOW.from))
    .then((model) => Promise.all([
      [WINDOW],
      [WINDOW_RECORDS, null, model],
    ].map((parameters) => endpoint.computeReport(...parameters))))
    .then((values) => {
      const report = values[0];

      t.true(isReport(report));
      t.is(report.recordsCount, WINDOW_LENGTH);

      values.slice(1).forEach((current) => t.deepEqual(report, current));
      t.snapshot(report);
    }));
});

test('computes a report with no values', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;

  return t.notThrows(Promise
    .all([
      [[], {}],
      [TEST_RECORDS, { minConfidence: 1 }],
      [TEST_RECORDS, { minAbsoluteDifference: Infinity }],
      [TEST_RECORDS, { minSigmaDifference: Infinity }],
    ].map((parameters) => endpoint.computeReport(...parameters)))
    .then((values) => values.forEach((report) => {
      t.true(isReport(report));
      t.falsy(report.values.length);
      t.true(Object.values(report.average).every(isNaN));
    })));
});


function isAnomaly(value) {
  return isPrediction(value) && typeof value.actualLoad === 'number';
}

function isAnomalies(object) {
  return object
    && typeof object === 'object'
    && typeof object.recordsCount === 'number'
    && object.recordsCount >= 0
    && Array.isArray(object.values)
    && object.values.every(isAnomaly)
    && object.values.length <= object.recordsCount;
}

function isPrediction(value) {
  return value
    && typeof value === 'object'
    && value.context
    && typeof value.context === 'object'
    && value.date instanceof Date
    && typeof value.predictedLoad === 'number'
    && typeof value.confidence === 'number'
    && value.confidence > 0 && value.confidence < 1
    && typeof value.standardDeviation === 'number'
    && Array.isArray(value.decisionRules);
}

function isPredictions(values) {
  return Array.isArray(values) && values.every(isPrediction);
}

function isReport(object) {
  return isAnomalies(object)
    && object.average
    && typeof object.average === 'object'
    && typeof object.average.actualLoad === 'number'
    && typeof object.average.predictedLoad === 'number'
    && typeof object.average.predictedStandardDeviation === 'number'
    && (isNaN(object.average.predictedStandardDeviation) || object.average.predictedStandardDeviation >= 0)
    && typeof object.average.absoluteDifference === 'number'
    && (isNaN(object.average.absoluteDifference) || object.average.absoluteDifference >= 0);
}


const DATE = Constants.DATE_FEATURE;
const INVALID_DATES = Helpers.INVALID_DATES;
const INVALID_NUMBERS = Helpers.INVALID_NUMBERS;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS.filter((object) => object !== null);
const RECORDS = Helpers.RECORDS;
const INDEX = Math.floor((RECORDS.length - 1) * .4);
const TRAINING_RECORDS = RECORDS.slice(0, INDEX);
const TEST_RECORDS = RECORDS.slice(INDEX);
const WINDOW_END = RECORDS.length - 1;
const WINDOW_START = Math.floor(WINDOW_END * .9);
const WINDOW_LENGTH = WINDOW_END - WINDOW_START + 1;
const WINDOW_RECORDS = RECORDS.slice(WINDOW_START);
const WINDOW = { from: RECORDS[WINDOW_START][DATE], to: RECORDS[WINDOW_END][DATE] };
