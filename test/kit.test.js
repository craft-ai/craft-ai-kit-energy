const test = require('ava');

const Helpers = require('./helpers');


test.before(require('dotenv').load);
test.beforeEach((t) => Helpers.createContext(t));
test.afterEach.always((t) => Helpers.destroyContext(t));


test('fails loading an endpoint with invalid definition', (t) => {
  const INVALID_DEFINITIONS = [undefined, null, 'string', 364, Promise.resolve({})];
  const INVALID_IDENTIFIERS = [undefined, null, 364, [false]];
  const INVALID_NUMBERS = Helpers.INVALID_NUMBERS;
  const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;

  const kit = t.context.kit;

  return Promise.all(INVALID_DEFINITIONS
    .concat(INVALID_IDENTIFIERS.map((id) => ({ id })))
    .concat(INVALID_OBJECTS.map((value) => ({ id: 'id', learning: value })))
    .concat(INVALID_NUMBERS.map((value) => ({ id: 'id', learning: { maxRecords: value } })))
    .concat(INVALID_NUMBERS.map((value) => ({ id: 'id', learning: { maxRecordAge: value } })))
    .map((definition) => t.throws(kit.loadEndpoint(definition))));
});

test('loads an endpoint', async(t) => {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;
  const id = context.endpoint.register();

  // The agent should not exist
  await t.throws(client.getAgent(id));

  const created = kit.loadEndpoint({ id });

  await t.notThrows(created);

  const endpointA = await created;
  const agentA = client.getAgent(id);

  // The agent should be created
  t.truthy(endpointA);
  t.is(endpointA.agentId, id);
  t.notThrows(agentA);

  const retrieved = kit.loadEndpoint({ id });

  await t.notThrows(retrieved);

  const endpointB = await retrieved;
  const agentB = client.getAgent(id);

  // The agent should be retrieved
  t.truthy(endpointB);
  t.is(endpointB.agentId, id);
  t.deepEqual(endpointA, endpointB);
  t.notThrows(agentB);
  t.deepEqual(await agentA, await agentB);
  t.snapshot(endpointA);
});

test('derives the agent\'s identifier when a secret is specified', async(t) => {
  await Helpers.createContext(t, { secret: 'a very strong secret' });

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
  const SEED = 1;

  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register(), learning: { maxRecords: SEED, maxRecordAge: SEED } })
    .then((endpoint) => kit.client.getAgent(endpoint.agentId))
    .then((agent) => {
      t.truthy(agent);
      t.is(typeof agent, 'object');
      t.truthy(agent.configuration);
      t.is(typeof agent.configuration, 'object');
      t.is(agent.configuration.tree_max_operations, SEED);
      t.is(agent.configuration.learning_period, SEED);
    });
});

test('closes the kit', (t) => {
  const kit = t.context.kit;

  return t.notThrows(kit
    .close()
    .then((result) => t.is(result, undefined)));
});
