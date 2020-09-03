const test = require('ava');

const EnergyKit = require('../../src/index');
const Constants = require('../../src/constants');
const Helpers = require('../helpers');

const ZONES = Helpers.ZONES;
const INVALID_ZONES = Helpers.INVALID_ZONES;
const INVALID_NUMBERS = Helpers.INVALID_NUMBERS;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const INVALID_STRINGS = Helpers.INVALID_STRINGS;
const PERIOD_ORIGINS = Helpers.PERIOD_ORIGINS;
// context constant
const LOAD = Constants.LOAD_FEATURE;
const TIMEZONE = Constants.TIMEZONE_FEATURE;
const PROPERTIES = { enumValue: { type: 'enum' }, numericValue: { type: 'continuous' } };
const DEFAULT_PROPERTIES = {
  'time': { type: 'time_of_day', is_generated: true },
  'day': { type: 'day_of_week', is_generated: true },
  'month': { type: 'month_of_year', is_generated: true },
  [TIMEZONE]: { type: 'timezone' },
  [LOAD]: { type: 'continuous' }
};
// configuration constant
const MIN_SAMPLES_PER_LEAF = 'min_samples_per_leaf';
const ADVANCED_CONFIGURATION = { [MIN_SAMPLES_PER_LEAF]: 1234 };
const DEFAULT_CONFIGURATION = {
  'context': DEFAULT_PROPERTIES,
  'output': ['load'],
  'operations_as_events': true,
  'tree_max_depth': 6,
  'tree_max_operations': 50000,
  'learning_period': 365 * 24 * 60 * 60
};

test.before(require('dotenv').config);
test.beforeEach(Helpers.createEndpointContext);
test.afterEach.always(Helpers.destroyEndpointContext);

test('fails loading an endpoint with invalid definition', (t) => {
  const INVALID_DEFINTIONS = [undefined].concat(INVALID_OBJECTS);
  const INVALID_IDENTIFIERS = [undefined].concat(INVALID_STRINGS);
  const INVALID_DURATIONS = INVALID_OBJECTS.concat([{}, { test: 1 }, { milliseconds: 0 }]);
  const INVALID_PERIOD_ORIGINS = INVALID_OBJECTS.concat([{ months: 0 }, { days: 0 }]);

  const kit = t.context.kit;

  return Promise.all(INVALID_DEFINTIONS
    .concat(INVALID_IDENTIFIERS.map((id) => ({ id })))
    .concat(INVALID_OBJECTS.map((value) => ({ id: 'id', learning: value })))
    .concat(INVALID_NUMBERS.map((value) => ({ id: 'id', learning: { maxRecords: value } })))
    .concat(INVALID_NUMBERS.map((value) => ({ id: 'id', learning: { maxRecordAge: value } })))
    .concat(INVALID_NUMBERS.map((value) => ({ id: 'id', learning: { maxTreeDepth: value } })))
    .concat(INVALID_OBJECTS.map((value) => ({ id: 'id', learning: { properties: value } })))
    .concat(INVALID_OBJECTS.map((value) => ({ id: 'id', energy: value })))
    .concat(INVALID_DURATIONS.map((value) => ({ id: 'id', energy: { period: value } })))
    .concat(INVALID_PERIOD_ORIGINS.map((value) => ({ id: 'id', energy: { origin: value } })))
    .concat(PERIOD_ORIGINS.map((value) => ({ id: 'id', energy: { origin: value } })))
    .concat(INVALID_OBJECTS.map((value) => ({ id: 'id', metadata: value })))
    .concat(INVALID_ZONES.map((value) => ({ id: 'id', metadata: { zone: value } })))
    .map((definition) => t.throwsAsync(kit.loadEndpoint(definition))));
});

test('loads an endpoint', async(t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;
  const id = context.endpoint.register();

  // The agent should not exist
  await t.throwsAsync(client.getAgent(id));

  const created = kit.loadEndpoint({ id });

  await t.notThrowsAsync(created);

  const endpointA = await created;
  const agentA = client.getAgent(id);

  // The agent should be created
  t.truthy(endpointA);
  t.is(endpointA.agentId, id);
  t.notThrowsAsync(agentA);

  const retrieved = kit.loadEndpoint({ id });

  await t.notThrowsAsync(retrieved);

  const endpointB = await retrieved;
  const agentB = client.getAgent(id);

  // The agent should be retrieved
  t.truthy(endpointB);
  t.is(endpointB.agentId, id);
  t.deepEqual(endpointA, endpointB);
  t.notThrowsAsync(agentB);
  t.deepEqual(await agentA, await agentB);
  t.snapshot(endpointA);
});

test('initializes an endpoint with the zone inherited from the kit', (t) => {
  const METADATA_OBJECTS = [{}, undefined];

  return EnergyKit
    .initialize({ zone: ZONES[0] })
    .then((kit) => Promise
      .all(METADATA_OBJECTS.map((metadata) => kit.loadEndpoint({ metadata, id: t.context.endpoint.register() })))
      .then((endpoints) => endpoints.forEach((endpoint) => {
        t.truthy(endpoint.metadata);
        t.is(typeof endpoint.metadata, 'object');
        t.is(endpoint.metadata.zone, kit.configuration.zone);
      })));
});

test('initializes an endpoint with a valid zone', (t) => {
  const zone = ZONES[0];

  return EnergyKit
    .initialize({ zone: ZONES[ZONES.length - 1] })
    .then((kit) => kit.loadEndpoint({ metadata: { zone }, id: t.context.endpoint.register() }))
    .then((endpoint) => {
      t.truthy(endpoint.metadata);
      t.is(typeof endpoint.metadata, 'object');
      t.is(endpoint.metadata.zone, zone);
    });
});

test('loads an endpoint by forcing the recreation of the agent', async(t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;
  const id = context.endpoint.register();

  // Load a first endpoint
  await kit.loadEndpoint({ id });

  const existingAgent = await client.getAgent(id);

  // Forces the load of a second endpoint with the same identifier
  await kit.loadEndpoint({ id }, true);

  const recreatedAgent = await client.getAgent(id);

  // The agent should be recreated
  t.true(existingAgent.creationDate < recreatedAgent.creationDate);
  t.is(existingAgent.id, recreatedAgent.id);
  t.deepEqual(existingAgent.configuration, recreatedAgent.configuration);
});

test('load endpoint twice at the same time', async(t) => {
  const context = t.context;
  const kit = context.kit;
  const id = context.endpoint.register();

  // Load a first endpoint
  return Promise.all([
    kit.loadEndpoint({ id }),
    kit.loadEndpoint({ id })
  ])
    .then(([endpoint1, endpoint2]) => {
      t.is(endpoint1.agent.id, endpoint2.agent.id);
      t.deepEqual(endpoint1.agent.configuration, endpoint2.agent.configuration);
    });
});

test('derives the agent\'s identifier when a secret is specified', async(t) => {
  await Helpers.createEndpointContext(t, { secret: 'a very strong secret' });

  const context = t.context;
  const kit = context.kit;
  const id = context.endpoint.register('test');

  return kit
    .loadEndpoint({ id })
    .then((endpoint) => {
      const agentId = endpoint.agentId;

      t.truthy(agentId);
      t.is(typeof agentId, 'string');
      t.not(agentId, id);
    });
});

test('configure an agent configuration', (t) => {
  const context = t.context;
  const kit = context.kit;

  // agent's configuration option
  const SEED = 1;

  // endpoint definition
  const definition = {
    id: context.endpoint.register(),
    metadata: { zone: 'Europe/Paris' },
    learning: {
      // agent's context
      properties: PROPERTIES,
      maxRecords: SEED,
      maxRecordAge: SEED,
      advancedConfiguration: ADVANCED_CONFIGURATION
    }
  };

  return kit
    .loadEndpoint(definition)
    .then((endpoint) => kit.client.getAgent(endpoint.agentId))
    .then((agent) => {
      t.truthy(agent);
      t.is(typeof agent, 'object');

      const configuration = agent.configuration;

      t.truthy(configuration);
      t.is(typeof configuration, 'object');
      t.is(configuration.tree_max_operations, SEED);
      t.is(configuration.learning_period, SEED);
      t.is(configuration[MIN_SAMPLES_PER_LEAF], 1234);

      const context = configuration.context;

      Object.keys(PROPERTIES)
        .forEach((key) => t.deepEqual(context[key], PROPERTIES[key]));
    });
});

test('configure an default agent configuration', (t) => {
  const context = t.context;
  const kit = context.kit;

  // endpoint definition
  const definition = {
    id: context.endpoint.register(),
    metadata: { zone: 'Europe/Paris' }
  };

  return kit
    .loadEndpoint(definition)
    .then((endpoint) => kit.client.getAgent(endpoint.agentId))
    .then((agent) => {
      t.truthy(agent);
      t.is(typeof agent, 'object');

      const configuration = agent.configuration;
      t.truthy(configuration);
      t.is(typeof configuration, 'object');
      t.is(configuration[MIN_SAMPLES_PER_LEAF], undefined);
      // We should only find the default configuration and context in the generated configuration
      Object.keys(DEFAULT_CONFIGURATION)
        .forEach((key) => t.deepEqual(configuration[key], DEFAULT_CONFIGURATION[key]));
    });
});

test('closes the kit', (t) => {
  const kit = t.context.kit;

  return t.notThrowsAsync(kit
    .close()
    .then((result) => t.is(result, undefined)));
});
