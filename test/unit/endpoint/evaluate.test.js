const test = require('ava');

const Constants = require('../../../src/constants');
const Helpers = require('../../helpers');
const Is = require('../../helpers/is');

const DATE = Constants.DATE_FEATURE;
const INVALID_DATES = Helpers.INVALID_DATES;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS.filter(
  (object) => object !== null
);
const RECORDS = Helpers.RECORDS;
const INDEX = Math.floor((RECORDS.length - 1) * 0.4);
const TRAINING_RECORDS = RECORDS.slice(0, INDEX);

function getPredictions(reports) {
  return reports.reduce(
    (predictions, report) => predictions.concat(report.values),
    []
  );
}

test.before(require('dotenv').config);

test.beforeEach((t) =>
  Helpers.createEndpointContext(t)
    .then(() => {
      const context = t.context;
      const kit = context.kit;

      return kit
        .loadEndpoint({
          id: context.endpoint.register(),
          metadata: { zone: 'Europe/Paris' }
        })
        .then((endpoint) => endpoint.update(TRAINING_RECORDS))
        .then((endpoint) => (t.context.endpoint.current = endpoint));
    })
);

test.afterEach.always(Helpers.destroyEndpointContext);

test('fails computing rolling evaluations with invalid parameters', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;
  const length = TRAINING_RECORDS.length;
  const interval = {
    from: TRAINING_RECORDS[0][DATE],
    to: TRAINING_RECORDS[length - 1][DATE]
  };

  const INVALID_PERIODS = [
    null,
    { minutes: 'one' },
    '1DAY',
    '1DT11H45',
    0,
    [],
    () => 5
  ];

  return Promise.all(
    []
      .concat(
        INVALID_OBJECTS.map((states) =>
          t.throwsAsync(endpoint.evaluate(states))
        )
      )
      .concat(
        INVALID_DATES.map((date) =>
          t.throwsAsync(endpoint.evaluate({ from: date }))
        )
      )
      .concat(
        INVALID_DATES.map((date) =>
          t.throwsAsync(endpoint.evaluate({ to: date }))
        )
      )
      .concat(
        INVALID_OBJECTS.map((option) =>
          t.throwsAsync(endpoint.evaluate(interval, option))
        )
      )
      .concat(
        INVALID_PERIODS.map((period) =>
          t.throwsAsync(() => endpoint.evaluate(interval, { period }),
            {
              instanceOf: Error
            }
          )
        )
      )
  );
});

test('fails retrieving evaluation interval when the agent has not been updated', (t) => {
  const context = t.context;
  const kit = context.kit;
  const from = TRAINING_RECORDS[0][DATE];
  const length = TRAINING_RECORDS.length;
  const to = TRAINING_RECORDS[length - 1][DATE];

  return kit
    .loadEndpoint({
      id: context.endpoint.register(),
      metadata: { zone: 'Europe/Paris' }
    })
    .then((endpoint) =>
      Promise.all([
        t.throwsAsync(endpoint.evaluate()),
        t.throwsAsync(endpoint.evaluate({ from })),
        t.throwsAsync(endpoint.evaluate({ from: undefined, to }))
      ])
    );
});

test('computes rolling evaluation', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;
  const length = TRAINING_RECORDS.length;
  const interval = {
    from: TRAINING_RECORDS[0][DATE],
    to: TRAINING_RECORDS[length - 1][DATE]
  };

  const PERIODS = [{ days: 2 }, 'P2DT0H0M0S', 172800 * 1000];

  return Promise.all(
    PERIODS.map((period) => endpoint.evaluate(interval, { period }))
  )
    .then((results) => {
      const result = results[0];
      result.forEach((report) => t.true(Is.report(report)));

      const predictions = getPredictions(result);
      t.true(Is.predictions(predictions));
      t.is(predictions.length, length);

      t.deepEqual(result, results[1]);
      t.deepEqual(result, results[2]);
    })
    .then(() =>
      Promise.all([
        endpoint.evaluate(interval, {}),
        endpoint.evaluate(interval)
      ])
    )
    .then((results) => {
      const result = results[0];
      result.forEach((report) => t.true(Is.report(report)));

      const predictions = getPredictions(result);
      t.true(Is.predictions(predictions));
      t.is(predictions.length, length);

      t.deepEqual(results[1], result);
    });
});

test('computes rolling evaluation with agent\'s first and last timestamps when no interval is provided', (t) => {
  const context = t.context;
  const endpoint = context.endpoint.current;
  const length = TRAINING_RECORDS.length;

  return endpoint.evaluate()
    .then((result) => {
      result.forEach((report) => t.true(Is.report(report)));

      const predictions = getPredictions(result);
      t.true(Is.predictions(predictions));
      t.is(predictions.length, length);
    });
});
