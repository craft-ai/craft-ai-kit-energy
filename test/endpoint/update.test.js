const test = require('ava');

const Constants = require('../../src/constants');
const Utils = require('../utils');


test.before(require('dotenv').load);
test.beforeEach(Utils.createContext);
test.afterEach.always(Utils.destroyContext);


test('fails updating the endpoint with invalid records', (t) => {
  const INVALID_RECORDS = [undefined, null, false, 762, 'records'];

  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => Promise.all([{}]
      .concat(INVALID_RECORDS)
      .concat(INVALID_RECORDS.map((record) => [record]))
      .map((records) => t.throws(endpoint.update(records)))));
});

test('fails updating the endpoint with records not passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;

  // Shuffle the records
  const records = context.shuffle(RECORDS);

  return Promise.all(INPUTS.map((pipe) => kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => t.throws(endpoint.update(pipe(records))))));
});

test('updates the endpoint with records passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe([])))
      .then((endpoint) => client
        .getAgentContextOperations(endpoint.agentId)
        .then((history) => t.true(Array.isArray(history) && !history.length))
        .then(() => endpoint.update(pipe(RECORDS))))
      .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))))
    .then((values) => {
      values.forEach((history) => {
        t.true(Array.isArray(history));
        t.is(history.length, RECORDS.length);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('filters out records which precede the endpoint\'s last sent record', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(RECORDS)))
      .then((endpoint) => client
        .getAgentContextOperations(endpoint.agentId)
        .then((history) => {
          t.true(Array.isArray(history));
          t.is(history.length, RECORDS.length);

          return endpoint
            .update(pipe(RECORDS))
            .then(() => client.getAgentContextOperations(endpoint.agentId))
            .then((updated) => t.deepEqual(updated, history))
            .then(() => history);
        }))))
    .then((values) => {
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('filters out records with invalid date formats', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  const dates = INVALID_DATES.concat([null]);
  const records = RECORDS
    .slice(0, dates.length)
    .map((record, index) => ({ ...record, [DATE]: dates[index] }));

  return t.notThrows(Promise.all(INPUTS.map((pipe) => kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(pipe(records)))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => t.true(Array.isArray(history) && !history.length)))));
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

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(records)))
      .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))))
    .then((values) => {
      values.forEach((history) => {
        // The special value should have replaced the real one
        t.true(Array.isArray(history));
        t.is(history.length, RECORDS.length);
        t.is(history[index].context[LOAD], SEED);
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
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

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(records)))
      .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))))
    .then((values) => {
      values.forEach((history) => {
        // The added partial records should be omitted
        t.true(Array.isArray(history));
        t.is(history.length, RECORDS.length);
        t.is(history[0].timestamp, Math.floor(timestamp / 1000));
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('removes unknown keys from records', (t) => {
  const UNKNOWN = 'unknown';

  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  // Add an unknown property to every records
  const records = RECORDS.map((record) => ({ ...record, [UNKNOWN]: true }));

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(records)))
      .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))))
    .then((values) => {
      values.forEach((history) => {
        t.true(Array.isArray(history));
        t.is(history.length, records.length);
        t.false(history.some((current) => UNKNOWN in current.context));
      });
      t.deepEqual(values[0], values[1]);
      t.snapshot(values[0]);
    }));
});

test('reduces the size of the records by dropping successive identical values', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrows(Promise
    .all(INPUTS.map((pipe) => kit
      .loadEndpoint({ id: context.endpoint.register() })
      .then((endpoint) => endpoint.update(pipe(RECORDS)))
      .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))))
    .then((values) => {
      const extracts = values.map((history) => {
        t.true(Array.isArray(history));
        t.is(history.length, RECORDS.length);

        const extract = history.filter((current) => TIMEZONE in current.context);

        t.true(extract.length >= 1);
        // May not be true with another dataset
        t.true(extract.length < history.length);

        return extract;
      });

      t.deepEqual(extracts[0], extracts[1]);
      t.snapshot(extracts[0]);
    }));
});

// test.todo('converts index values to mean electrical loads');


const DATE = Constants.DATE_FEATURE;
const INPUTS = Utils.INPUT_METHODS;
const INVALID_DATES = Utils.INVALID_DATES;
const LOAD = Constants.LOAD_FEATURE;
const RECORDS = Utils.RECORDS;
const TIMEZONE = Constants.TIMEZONE_FEATURE;
