const path = require('path');
const test = require('ava');

const Constants = require('../../src/constants');
const Helpers = require('../helpers');


test.before(require('dotenv').load);
test.beforeEach(Helpers.createEndpointContext);
test.afterEach.always(Helpers.destroyEndpointContext);


test('fails updating the endpoint with invalid records', (t) => {
  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => Promise.all([{}]
      .concat(INVALID_OBJECTS)
      .concat(INVALID_OBJECTS.map((record) => [record]))
      .map((records) => t.throws(endpoint.update(records)))));
});

test('fails updating the endpoint with records not passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;

  // Shuffle the records
  const records = context.shuffle(RECORDS);

  return kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => t.throws(endpoint.update(records)));
});

test('updates the endpoint', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrows(Promise
    .all([
      [[[]], [RECORDS]],
      [[Helpers.streamify([])], [Helpers.streamify(RECORDS)]],
      [
        [path.join(__dirname, '../helpers/data/records.csv'), { import: { to: 0 } }],
        [path.join(__dirname, '../helpers/data/records.csv')]
      ]
    ].map((parameters) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(...parameters[0]))
      .then((endpoint) => client
        .getAgentContextOperations(endpoint.agentId)
        .then((history) => {
          t.true(Array.isArray(history));
          t.is(history.length, 0);

          return endpoint.update(...parameters[1]);
        }))
      .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))))
    .then((values) => {
      const history = values[0];

      t.true(Array.isArray(history));
      t.is(history.length, RECORDS.length);

      values.slice(1).forEach((current) => t.deepEqual(history, current));
      t.snapshot(history);
    }));
});

test('filters out records which precede the endpoint\'s last sent record', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(RECORDS))
    .then((endpoint) => client
      .getAgentContextOperations(endpoint.agentId)
      .then((history) => {
        t.true(Array.isArray(history));
        t.is(history.length, RECORDS.length);

        return endpoint
          .update(RECORDS)
          .then(() => client.getAgentContextOperations(endpoint.agentId))
          .then((updated) => {
            t.deepEqual(updated, history);
            t.snapshot(history);
          });
      })));
});

test('filters out records with invalid date formats', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  const dates = INVALID_DATES.concat([null]);
  const records = RECORDS
    .slice(0, dates.length)
    .map((record, index) => ({ ...record, [DATE]: dates[index] }));

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(records))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, 0);
    }));
});

test('merges records with the same date', (t) => {
  const SEED = -1;

  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  // Duplicate an entry with a special value
  const index = context.random(RECORDS.length - 1);
  const records = [...RECORDS];

  records.splice(index + 1, 0, { [DATE]: RECORDS[index][DATE], [LOAD]: SEED });

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(records))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS.length);
      // The special value should have replaced the real one
      t.is(history[index].context[LOAD], SEED);
      t.snapshot(history);
    }));
});

test('merges partial records until first full record', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  // Create some partial records only containing the date
  const timestamp = new Date(RECORDS[0][DATE]).getTime();
  const timestamps = new Array(10).fill(timestamp).map((date, index) => date - ((index + 1) * 60 * 60 * 1000));
  const records = timestamps.reverse().map((date) => ({ [DATE]: date })).concat(RECORDS);

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(records))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS.length);
      // The added partial records should be omitted
      t.is(history[0].timestamp, Math.floor(timestamp / 1000));
      t.snapshot(history);
    }));
});

test('removes unknown keys from records', (t) => {
  const UNKNOWN = 'unknown';

  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  // Add an unknown property to every records
  const records = RECORDS.map((record) => ({ ...record, [UNKNOWN]: true }));

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(records))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, records.length);
      // The added unknown property should never appear in the history
      t.false(history.some((current) => UNKNOWN in current.context));
      t.snapshot(history);
    }));
});

test('reduces the size of the records by dropping successive identical values', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrows(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(RECORDS))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS.length);

      const extract = history.filter((current) => TIMEZONE in current.context);

      t.true(extract.length >= 1);
      // May not be true with another dataset
      t.true(extract.length < history.length);
      t.snapshot(extract);
    }));
});

// test.todo('converts index values to mean electrical loads');


const DATE = Constants.DATE_FEATURE;
const INVALID_DATES = Helpers.INVALID_DATES;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const LOAD = Constants.LOAD_FEATURE;
const RECORDS = Helpers.RECORDS;
const TIMEZONE = Constants.TIMEZONE_FEATURE;
