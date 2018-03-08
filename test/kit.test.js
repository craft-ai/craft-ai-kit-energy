const test = require('ava');

const EnergyKit = require('../src/index');
const Utils = require('./utils');


test.before(require('dotenv').load);
test.beforeEach((t) => Utils.createContext(t));
test.afterEach.always((t) => Utils.destroyContext(t));


test('fails loading an endpoint with invalid parameters', (t) => {
  const kit = t.context.kit;

  return Promise.all([
    t.throws(kit.loadEndpoint()),
    t.throws(kit.loadEndpoint({})),
  ]);
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
  const SECRET = 'a very strong secret';
  const ID = 'test';

  const kit = await EnergyKit.initialize({ secret: SECRET });
  const agentId = (await kit.loadEndpoint({ id: ID })).agentId;

  t.truthy(agentId);
  t.is(typeof agentId, 'string');
  t.not(agentId, ID);
});

test('configures the agent\'s learning configuration', (t) => {
  const SEED = 1;

  const context = t.context;
  const kit = context.kit;
  const id = context.endpoint.register();

  return kit
    .loadEndpoint({ id, learning: { maxRecords: SEED, maxRecordAge: SEED } })
    .then(() => kit.client.getAgent(id))
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
