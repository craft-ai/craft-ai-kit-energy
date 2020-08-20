const path = require('path');
const test = require('ava');

const Constants = require('../../../src/constants');
const Utils = require('../../../src/utils');
const Helpers = require('../../helpers');

const DATE = Constants.DATE_FEATURE;
const INVALID_DATES = Helpers.INVALID_DATES;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const LOAD = Constants.LOAD_FEATURE;
const PERIOD_ORIGINS = Helpers.PERIOD_ORIGINS;
const RECORDS = Helpers.RECORDS;
const RECORDS_AS_ACCUMULATED_ENERGY = Helpers.RECORDS_AS_ACCUMULATED_ENERGY;
const RECORDS_AS_ACCUMULATED_ENERGY_DST = Helpers.RECORDS_AS_ACCUMULATED_ENERGY_DST;
const RECORDS_AS_ENERGY = Helpers.RECORDS_AS_ENERGY;
const RECORDS_DST = Helpers.RECORDS_DST;
const TIMEZONE = Constants.TIMEZONE_FEATURE;
const INDEX = Math.floor((RECORDS.length - 1) * .4);

function toRecords(history, utcFormat = true) {
  const state = Object.defineProperty({}, 'timezone', { writable: true });

  return history.map((current) => {
    const timestamp = current.timestamp * 1000;
    Object.assign(state, {
      [DATE]: utcFormat
        ? new Date(timestamp)
          .toISOString()
        : Utils.setZone(Utils.parseDate(timestamp), current[TIMEZONE])
          .toISO(),
      ...current.context
    });

    return { ...state };
  });
}

test.before(require('dotenv').config);

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
      [[[]], [path.join(__dirname, '../../helpers/data/records.csv')]]
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
      values.slice(1)
        .forEach((current) => t.deepEqual(history, current));
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
  const timestamp = new Date(RECORDS[0][DATE])
    .getTime();
  const timestamps = new Array(11)
    .fill(timestamp)
    .map((date, index) => ({ [DATE]: date - index * 3600 * 1000, [LOAD]: 0 }));
  const records = timestamps.slice(1)
    .reverse()
    .concat(RECORDS.map((record, index) => ({ ...record, index })));

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
      energy: { period: 30 * 60 }
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

  return Promise
    .all(PERIOD_ORIGINS.map((origin) => kit
      .loadEndpoint({
        id: context.endpoint.register(),
        energy: { origin, period: 24 * 3600 },
        metadata: { zone: 'Europe/Paris' }
      })
      .then((endpoint) => endpoint.update(RECORDS_AS_ACCUMULATED_ENERGY))
      .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))))
    .then((histories) => {
      const history = histories[0];

      t.true(Array.isArray(history));
      t.is(history.length, RECORDS_AS_ACCUMULATED_ENERGY.length);

      // Avoid rounding issue when comparing to the source
      const records = toRecords(history)
        .map((record) => ({ ...record, [LOAD]: Math.round(record[LOAD] * 10) / 10 }));

      t.deepEqual(records, RECORDS);
      histories.slice(1)
        .forEach((currentHistory) => t.deepEqual(currentHistory, history));
    });
});

test('converts accumulated energy values to mean electrical loads with daytime saving', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return kit
    .loadEndpoint({
      id: context.endpoint.register(),
      energy: { origin: '02:00:00', period: 24 * 3600 },
      metadata: { zone: 'Europe/Paris' }
    })
    .then((endpoint) => endpoint.update(RECORDS_AS_ACCUMULATED_ENERGY_DST))
    .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
    .then((history) => {
      t.true(Array.isArray(history));
      t.is(history.length, RECORDS_AS_ACCUMULATED_ENERGY_DST.length);

      // Avoid rounding issue when comparing to the source
      const records = toRecords(history, false)
        .map((record) => ({ ...record, [LOAD]: Math.round(record[LOAD] * 10) / 10 }));

      t.deepEqual(records, RECORDS_DST);
    });
});

test('uses timezone information provided as a feature to parse dates', (t) => {
  const context = t.context;
  const kit = context.kit;
  const offset = '+07:00';

  const RECORDS_WITH_TIMEZONES = RECORDS.map((record) => ({ ...record, [TIMEZONE]: `utc${offset}` }));

  return kit
    .loadEndpoint({ id: context.endpoint.register('test'), metadata: { zone: 'Europe/Paris' } })
    .then((endpoint) => endpoint.update(RECORDS_WITH_TIMEZONES))
    .then((endpoint) => kit.client.getAgentStateHistory(endpoint.agentId))
    .then((history) => {
      const offsets = new Array(RECORDS.length)
        .fill(offset);

      t.deepEqual(history.map((state) => state.sample[TIMEZONE]), offsets);
    });
});

test('parses continuous features\'s values into numbers', (t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return t.notThrowsAsync(kit
    .loadEndpoint({
      id: context.endpoint.register(),
      learning: {
        properties: { property: { type: 'continuous' } }
      }
    })
    .then((endpoint) => endpoint
      .update(RECORDS.slice(0, INDEX)
        .map((record) => ({ ...record, property: '5' })))
      .then((endpoint) => client.getAgentContextOperations(endpoint.agentId))
      .then((operations1) => {
        t.is(operations1.length, INDEX);
        t.is(operations1[0].context.property, 5);
        t.is(typeof operations1[0].context.property, 'number');

        const properties = operations1.slice(1)
          .map((operation) => operation.context.property);

        t.deepEqual(properties, new Array(INDEX - 1)
          .fill(5));
      })));
});
