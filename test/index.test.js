const test = require('ava');

const EnergyKit = require('../src/index');


test.before(require('dotenv').load);
test.afterEach.always((t) => process.env.CRAFT_AI_TOKEN = t.context.token);

test.beforeEach((t) => {
  t.context = { token: process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN };
  delete process.env.CRAFT_TOKEN;
});


// Must be serial as it has side effects on `process.env`
test.serial('fails with invalid configurations', async(t) => {
  const WRONG_TOKEN = 'I am a bad, bad token';
  const WRONG_SECRET = 713705;

  delete process.env.CRAFT_AI_TOKEN;

  await Promise.all([
    t.throws(EnergyKit.initialize()),
    t.throws(EnergyKit.initialize({ token: null })),
  ]);

  process.env.CRAFT_AI_TOKEN = WRONG_TOKEN;

  await Promise.all([
    t.throws(EnergyKit.initialize()),
    t.throws(EnergyKit.initialize({ token: WRONG_TOKEN })),
    t.throws(EnergyKit.initialize({ token: t.context.token, secret: WRONG_SECRET })),
  ]);
});

test('initializes the kit', async(t) => {
  const SECRET = 'a very strong secret';

  const promise = EnergyKit.initialize();

  await Promise.all([
    t.notThrows(promise),
    t.notThrows(EnergyKit.initialize({ secret: SECRET })),
    t.notThrows(EnergyKit.initialize({ token: t.context.token })),
    t.notThrows(EnergyKit.initialize({ token: t.context.token, secret: SECRET })),
  ]);

  const kit = await promise;

  t.truthy(kit);
  t.is(typeof kit, 'object');
  t.truthy(kit.client);
  t.is(typeof kit.client, 'object');
  t.is(typeof kit.loadEndpoint, 'function');
  t.is(typeof kit.close, 'function');
});
