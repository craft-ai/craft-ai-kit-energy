const test = require('ava');

const EnergyKit = require('../src/index');
const Helpers = require('./helpers');


test.before(require('dotenv').load);
test.beforeEach(Helpers.createEndpointContext);
test.afterEach.always(Helpers.destroyEndpointContext);


test('fails loading an endpoint with invalid definition', (t) => {
  const INVALID_DEFINTIONS = [undefined].concat(INVALID_OBJECTS);
  const INVALID_IDENTIFIERS = [undefined].concat(INVALID_STRINGS);
  const INVALID_DURATIONS = INVALID_OBJECTS.concat([{}, { test: 1 }, { milliseconds: 0 }]);
  const INVALID_ORIGINS = INVALID_OBJECTS.concat([{ months: 0 }, { days: 0 }]);
  const VALID_ORIGINS = [{ years: 2016, months: 1, days: 1 }];

  const kit = t.context.kit;

  return Promise.all(INVALID_DEFINTIONS
    .concat(INVALID_IDENTIFIERS.map((id) => ({ id })))
    .concat(INVALID_OBJECTS.map((value) => ({ id: 'id', learning: value })))
    .concat(INVALID_NUMBERS.map((value) => ({ id: 'id', learning: { maxRecords: value } })))
    .concat(INVALID_NUMBERS.map((value) => ({ id: 'id', learning: { maxRecordAge: value } })))
    .concat(INVALID_OBJECTS.map((value) => ({ id: 'id', learning: { properties: value } })))
    .concat(INVALID_OBJECTS.map((value) => ({ id: 'id', energy: value })))
    .concat(INVALID_DURATIONS.map((value) => ({ id: 'id', energy: { period: value } })))
    .concat(INVALID_ORIGINS.map((value) => ({ id: 'id', energy: { origin: value } })))
    .concat(VALID_ORIGINS.map((value) => ({ id: 'id', energy: { origin: value } })))
    .concat(INVALID_OBJECTS.map((value) => ({ id: 'id', metadata: value })))
    .concat(INVALID_IANA_ZONES.map((value) => ({ id: 'id', metadata: { zone: value } })))
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

test('initializes zone-less endpoint with kit\'s zone', async(t) => {
  const index = t.context.random(IANA_ZONES.length - 1);
  const kitZone = IANA_ZONES[index];

  const METADATA_OBJECTS = [{}, undefined];

  // Kit with zone, Endpoint with undefined zone : the kit's zone is used
  return EnergyKit
    .initialize({ zone : kitZone, recordBulkSize: 1000 })
    .then((kit) => Promise.all(METADATA_OBJECTS.map((metadata) => kit.loadEndpoint({ metadata, id : t.context.endpoint.register() }))))
    .then((endpoints) => endpoints
      .map((endpoint) => {
        t.not(endpoint.metadata, undefined);
        t.is(endpoint.metadata.zone, kitZone);
      })
    );
});

test('initializes the endpoint with a valid zone when provided', async(t) => {
  const index = t.context.random(IANA_ZONES.length - 1);
  const kitZone = IANA_ZONES[index];
  const endpointZone = index == 0 ? IANA_ZONES[IANA_ZONES.length - 1] : IANA_ZONES[index - 1];

  // Kit with zone, Endpoint with valid zone : the endpoind's zone is kept
  return EnergyKit
    .initialize({ zone : kitZone, recordBulkSize: 1000 })
    .then((kit) => kit.loadEndpoint({ metadata : { zone : endpointZone }, id :  t.context.endpoint.register() }))
    .then((endpoint) => t.is(endpoint.metadata.zone, endpointZone));
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

test('configures the agent\'s learning configuration', (t) => {
  const PROPERTIES = { enumValue: { type: 'enum' }, numericValue: { type: 'continuous' } };
  const SEED = 1;

  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({
      id: context.endpoint.register(),
      learning: { properties: PROPERTIES, maxRecords: SEED, maxRecordAge: SEED }
    })
    .then((endpoint) => kit.client.getAgent(endpoint.agentId))
    .then((agent) => {
      t.truthy(agent);
      t.is(typeof agent, 'object');

      const configuration = agent.configuration;

      t.truthy(configuration);
      t.is(typeof configuration, 'object');
      t.is(configuration.tree_max_operations, SEED);
      t.is(configuration.learning_period, SEED);

      const context = configuration.context;

      Object.keys(PROPERTIES).forEach((key) => t.deepEqual(context[key], PROPERTIES[key]));
    });
});

test('closes the kit', (t) => {
  const kit = t.context.kit;

  return t.notThrowsAsync(kit
    .close()
    .then((result) => t.is(result, undefined)));
});


const IANA_ZONES = Helpers.IANA_ZONES;
const INVALID_IANA_ZONES = Helpers.INVALID_IANA_ZONES;
const INVALID_NUMBERS = Helpers.INVALID_NUMBERS;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const INVALID_STRINGS = Helpers.INVALID_STRINGS;
