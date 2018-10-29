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
      .map((records) => t.throwsAsync(endpoint.update(records)))));
});

test('fails updating the endpoint with records not passed in chronological order', (t) => {
  const context = t.context;
  const kit = context.kit;

  // Shuffle the records
  const records = context.shuffle(RECORDS);

  return kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => t.throwsAsync(endpoint.update(records)));
});

test('updates the endpoint', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrowsAsync(Promise
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
      t.deepEqual(toRecords(history), RECORDS);
    }));
});

test('filters out records which precede the endpoint\'s last sent record', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrowsAsync(kit
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
            t.deepEqual(toRecords(history), RECORDS);
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

  return t.notThrowsAsync(kit
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
  const load = RECORDS[index][LOAD];

  records.splice(index + 1, 0, { [DATE]: RECORDS[index][DATE], [LOAD]: SEED });

  return t.notThrowsAsync(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(records))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS.length);
      // The special value should have replaced the real one
      t.is(history[index].context[LOAD], SEED);

      const records = toRecords(history);

      records[index][LOAD] = load;
      t.deepEqual(records, RECORDS);
    }));
});

test('removes unknown keys from records', (t) => {
  const UNKNOWN = 'unknown';

  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  // Add an unknown property to every records
  const records = RECORDS.map((record) => ({ ...record, [UNKNOWN]: true }));

  return t.notThrowsAsync(kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint.update(records))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, records.length);
      // The added unknown property should never appear in the history
      t.false(history.some((current) => UNKNOWN in current.context));
      t.deepEqual(toRecords(history), RECORDS);
    }));
});

test('reduces the size of the records by dropping successive identical values', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrowsAsync(kit
    .loadEndpoint({ id: context.endpoint.register(), metadata: { zone : 'Europe/Paris' }})
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

test('supports additional embedded context properties', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  const records = RECORDS.map((record, index) => ({ ...record, index }));

  return t.notThrowsAsync(kit
    .loadEndpoint({
      id: context.endpoint.register(),
      learning: { properties: { index: { type: 'continuous' } } }
    })
    .then((endpoint) => endpoint.update(records))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, records.length);
      t.true(history.every((current, index) => current.context.index === index));
    }));
});

test('merges partial records until first full record', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  // Add some partial records not containing the embedded property `index`
  const timestamp = new Date(RECORDS[0][DATE]).getTime();
  const timestamps = new Array(11)
    .fill(timestamp)
    .map((date, index) => ({ [DATE]: date - index * 3600 * 1000, [LOAD]: 0 }));
  const records = timestamps.slice(1).reverse().concat(RECORDS.map((record, index) => ({ ...record, index })));

  return t.notThrowsAsync(kit
    .loadEndpoint({
      id: context.endpoint.register(),
      learning: { properties: { index: { type: 'continuous' } } }
    })
    .then((endpoint) => endpoint.update(records))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS.length);
      // The added partial records should be omitted
      t.deepEqual(toRecords(history), records.slice(10));
    }));
});

test('converts energy values to mean electrical loads', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrowsAsync(kit
    .loadEndpoint({
      id: context.endpoint.register(),
      energy: { period: { minutes: 30 },
      metadata: { zone : 'Europe/Paris' }}
    })
    .then((endpoint) => endpoint.update(RECORDS_AS_ENERGY))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS_AS_ENERGY.length);
      t.deepEqual(toRecords(history), RECORDS);
    }));
});

test('converts accumulated energy values to mean electrical loads', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrowsAsync(kit
    .loadEndpoint({
      id: context.endpoint.register(),
      energy: {
        origin: { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 },
        period: { days: 1 }
      },
      metadata: { zone : 'Europe/Paris' }
    })
    .then((endpoint) => endpoint.update(RECORDS_AS_ACCUMULATED_ENERGY))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS_AS_ACCUMULATED_ENERGY.length);

      const records = toRecords(history);

      // Avoid rounding issue when comparing to the source
      records.forEach((record) => record[LOAD] = Math.round(record[LOAD] * 10) / 10);
      t.deepEqual(records, RECORDS);
    }));
});


function toRecords(history) {
  const state = Object.defineProperty({}, 'timezone', { writable: true });

  return history.map((current) => {
    Object.assign(state, {
      ...current.context,
      [DATE]: new Date(current.timestamp * 1000).toISOString()
    });

    return { ...state };
  });
}


const DATE = Constants.DATE_FEATURE;
const INVALID_DATES = Helpers.INVALID_DATES;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const LOAD = Constants.LOAD_FEATURE;
const RECORDS = Helpers.RECORDS;
const RECORDS_AS_ACCUMULATED_ENERGY = Helpers.RECORDS_AS_ACCUMULATED_ENERGY;
const RECORDS_AS_ENERGY = Helpers.RECORDS_AS_ENERGY;
const TIMEZONE = Constants.TIMEZONE_FEATURE;
