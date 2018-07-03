const test = require('ava');

const Constants = require('../../src/constants');
const Helpers = require('../helpers');


test.before(require('dotenv').load);
test.beforeEach(Helpers.createContext);
test.afterEach.always(Helpers.destroyContext);


test('fails computing predictions with invalid parameters', (t) => {
  const context = t.context;
  const kit = context.kit;

  return Promise.all(INPUTS.map((pipe) => kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
    .then((endpoint) => {
      return Promise.all(INVALID_DATES.map((date) => t.throws(endpoint.computePredictions(pipe([]), date))));
    })));
});

test('fails computing predictions with states not passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;

  // Shuffle the states
  const states = context.shuffle(TEST_RECORDS);

  return Promise.all(INPUTS.map((pipe) => kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
    .then((endpoint) => t.throws(endpoint.computePredictions(pipe(states))))));
});

test('computes predictions with states passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
      .then((endpoint) => endpoint.computePredictions(pipe(TEST_RECORDS)))))
    .then((values) => {
      values.forEach((predictions) => {
        t.true(isPredictions(predictions));
        t.is(predictions.length, TEST_RECORDS.length);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('computes predictions given a model', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
      .then((endpoint) => endpoint
        .retrievePredictiveModel()
        .then((model) => endpoint.computePredictions(pipe(TEST_RECORDS), model)))))
    .then((values) => {
      values.forEach((predictions) => {
        t.true(isPredictions(predictions));
        t.is(predictions.length, TEST_RECORDS.length);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('filters out states with invalid date formats', (t) => {
  const context = t.context;
  const kit = context.kit;

  const dates = INVALID_DATES.concat([null]);
  const states = TEST_RECORDS
    .slice(0, dates.length)
    .map((state, index) => ({ ...state, [DATE]: dates[index] }));

  return t.notThrows(Promise.all(INPUTS.map((pipe) => kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
    .then((endpoint) => endpoint.computePredictions(pipe(states)))
    .then((predictions) => t.true(Array.isArray(predictions) && !predictions.length)))));
});

test('merges states with the same date', (t) => {
  const context = t.context;
  const kit = context.kit;

  // Add a duplicate state
  const index = context.random(TEST_RECORDS.length - 1);
  const states = [...TEST_RECORDS];

  states.splice(index + 1, 0, { [DATE]: TEST_RECORDS[index][DATE] });

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
      .then((endpoint) => endpoint.computePredictions(pipe(states)))))
    .then((values) => {
      values.forEach((predictions) => {
        // The duplicate state should be omitted
        t.true(isPredictions(predictions));
        t.is(predictions.length, TEST_RECORDS.length);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('merges partial states until first full state', (t) => {
  const context = t.context;
  const kit = context.kit;

  // Add some empty states
  const states = [{}, {}, {}].concat(TEST_RECORDS);

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
      .then((endpoint) => endpoint.computePredictions(pipe(states)))))
    .then((values) => {
      values.forEach((predictions) => {
        // The added empty states should be omitted
        t.true(isPredictions(predictions));
        t.is(predictions.length, TEST_RECORDS.length);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('fails computing anomalies with invalid parameters', (t) => {
  const context = t.context;
  const kit = context.kit;

  return Promise.all(INPUTS.map((pipe) => kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
    .then((endpoint) => Promise.all([endpoint.computeAnomalies(null)]
      .concat(INVALID_OBJECTS.map((records) => endpoint.computeAnomalies(records)))
      .concat(INVALID_OBJECTS.map((options) => endpoint.computeAnomalies(pipe([]), options)))
      .concat(INVALID_NUMBERS.map((value) => endpoint.computeAnomalies(pipe([]), { minConfidence: value })))
      .concat(INVALID_NUMBERS.map((value) => endpoint.computeAnomalies(pipe([]), { minAbsoluteDifference: value })))
      .concat(INVALID_NUMBERS.map((value) => endpoint.computeAnomalies(pipe([]), { minSigmaDifference: value })))
      .concat(INVALID_DATES.map((date) => endpoint.computeAnomalies(pipe([]), null, date)))
      .map((promise) => t.throws(promise))))));
});

test('fails computing anomalies with records not passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;

  // Shuffle the records
  const records = context.shuffle(TEST_RECORDS);

  return Promise.all(INPUTS.map((pipe) => kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
    .then((endpoint) => t.throws(endpoint.computeAnomalies(pipe(records))))));
});

test('computes anomalies from records passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
      .then((endpoint) => endpoint.computeAnomalies(pipe(TEST_RECORDS)))))
    .then((values) => {
      values.forEach((anomalies) => {
        t.true(isAnomalies(anomalies));
        t.is(anomalies.recordsCount, TEST_RECORDS.length);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('computes anomalies from records given a model', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
      .then((endpoint) => endpoint
        .retrievePredictiveModel()
        .then((model) => endpoint.computeAnomalies(pipe(TEST_RECORDS), null, model)))))
    .then((values) => {
      values.forEach((anomalies) => {
        t.true(isAnomalies(anomalies));
        t.is(anomalies.recordsCount, TEST_RECORDS.length);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('computes anomalies from a window', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(RECORDS))
    .then((endpoint) => Promise.all([
      endpoint.computeAnomalies(WINDOW),
      endpoint.retrievePredictiveModel(WINDOW.from).then((model) => endpoint.computeAnomalies(WINDOW, null, model))
    ]))
    .then((values) => {
      values.forEach((anomalies) => {
        t.true(isAnomalies(anomalies));
        t.is(anomalies.recordsCount, WINDOW_LENGTH);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('filters out anomalies given custom thresholds', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(TRAINING_RECORDS))
    .then((endpoint) => Promise.all([
      endpoint.computeAnomalies([], {}),
      endpoint.computeAnomalies(TEST_RECORDS, { minConfidence: 1 }),
      endpoint.computeAnomalies(TEST_RECORDS, { minAbsoluteDifference: Infinity }),
      endpoint.computeAnomalies(TEST_RECORDS, { minSigmaDifference: Infinity }),
    ]))
    .then((values) => values.forEach((anomalies) => t.true(isAnomalies(anomalies) && !anomalies.values.length))));
});

test('fails computing a report with invalid parameters', (t) => {
  const context = t.context;
  const kit = context.kit;

  return Promise.all(INPUTS.map((pipe) => kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(pipe(TEST_RECORDS)))
    .then((endpoint) => Promise.all([endpoint.computeReport(null)]
      .concat(INVALID_OBJECTS.map((options) => endpoint.computeReport(pipe([]), options)))
      .concat(INVALID_NUMBERS.map((value) => endpoint.computeReport(pipe([]), { minConfidence: value })))
      .concat(INVALID_NUMBERS.map((value) => endpoint.computeReport(pipe([]), { minAbsoluteDifference: value })))
      .concat(INVALID_NUMBERS.map((value) => endpoint.computeReport(pipe([]), { minSigmaDifference: value })))
      .concat(INVALID_DATES.map((date) => endpoint.computeReport(pipe([]), null, date)))
      .map((promise) => t.throws(promise))))));
});

test('fails computing a report with records not passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;

  // Shuffle the records
  const records = context.shuffle(TEST_RECORDS);

  return Promise.all(INPUTS.map((pipe) => kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
    .then((endpoint) => t.throws(endpoint.computeReport(pipe(records))))));
});

test('computes a report from records passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
      .then((endpoint) => endpoint.computeReport(pipe(TEST_RECORDS)))))
    .then((values) => {
      values.forEach((report) => {
        t.true(isReport(report));
        t.is(report.recordsCount, TEST_RECORDS.length);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('computes a report from records given a model', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(TRAINING_RECORDS)))
      .then((endpoint) => endpoint
        .retrievePredictiveModel()
        .then((model) => endpoint.computeReport(pipe(TEST_RECORDS), null, model)))))
    .then((values) => {
      values.forEach((report) => {
        t.true(isReport(report));
        t.is(report.recordsCount, TEST_RECORDS.length);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('computes a report from a window', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(RECORDS))
    .then((endpoint) => Promise.all([
      endpoint.computeReport(WINDOW),
      endpoint.retrievePredictiveModel(WINDOW.from).then((model) => endpoint.computeReport(WINDOW, null, model))
    ]))
    .then((values) => {
      values.forEach((report) => {
        t.true(isReport(report));
        t.is(report.recordsCount, WINDOW_LENGTH);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('computes a report with no values', (t) => {
  const context = t.context;
  const kit = context.kit;

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(TRAINING_RECORDS))
    .then((endpoint) => Promise.all([
      endpoint.computeReport([], {}),
      endpoint.computeReport(TEST_RECORDS, { minConfidence: 1 }),
      endpoint.computeReport(TEST_RECORDS, { minAbsoluteDifference: Infinity }),
      endpoint.computeReport(TEST_RECORDS, { minSigmaDifference: Infinity }),
    ]))
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
const INPUTS = Helpers.INPUT_METHODS;
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
const WINDOW = { from: RECORDS[WINDOW_START][DATE], to: RECORDS[WINDOW_END][DATE] };
