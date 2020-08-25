const test = require('ava');

const EnergyKit = require('../../src/index');
const Helpers = require('../helpers');

const INVALID_ZONES = Helpers.INVALID_ZONES;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const INVALID_STRINGS = Helpers.INVALID_STRINGS;

test.before(require('dotenv').config);

test.beforeEach((t) => {
  t.context = { token: process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN };
  delete process.env.CRAFT_TOKEN;
});

test.afterEach.always((t) => process.env.CRAFT_AI_TOKEN = t.context.token);

// Must be serial as it has side effects on `process.env`
test.serial('fails initializing the kit with invalid configurations', async(t) => {
  const INVALID_TOKENS = [undefined].concat(INVALID_STRINGS, 'very bad token');
  const INVALID_SECRETS = INVALID_STRINGS.concat(['']);

  await Promise.all(INVALID_OBJECTS.map((configuration) => t.throwsAsync(EnergyKit.initialize(configuration))));

  // Invalid secrets, valid token passed through an environment variable
  await Promise.all(INVALID_SECRETS.map((secret) => t.throwsAsync(EnergyKit.initialize({ secret }))));

  // Invalid tokens passed through an environment variable
  for (const token of INVALID_TOKENS) {
    process.env.CRAFT_AI_TOKEN = token;
    await t.throwsAsync(EnergyKit.initialize());
  }

  // Other cases, tokens passed as a property of the kit's configuration
  delete process.env.CRAFT_AI_TOKEN;

  await Promise.all([EnergyKit.initialize()]
    .concat(INVALID_TOKENS.map((token) => EnergyKit.initialize({ token })))
    .concat(INVALID_SECRETS.map((secret) => EnergyKit.initialize({ token: t.context.token, secret })))
    .concat(INVALID_ZONES.map((zone) => EnergyKit.initialize({ token: t.context.token, zone })))
    .map((promise) => t.throwsAsync(promise)));
});

test('initializes the kit', async(t) => {
  const SECRET = 'valid secret';

  const promise = EnergyKit.initialize();

  await Promise.all([
    t.notThrowsAsync(promise),
    t.notThrowsAsync(EnergyKit.initialize({ secret: SECRET })),
    t.notThrowsAsync(EnergyKit.initialize({ token: t.context.token })),
    t.notThrowsAsync(EnergyKit.initialize({ token: t.context.token, secret: SECRET }))
  ]);

  const kit = await promise;

  t.truthy(kit);
  t.is(typeof kit, 'object');
  t.truthy(kit.client);
  t.is(typeof kit.client, 'object');
  t.is(typeof kit.loadEndpoint, 'function');
  t.is(typeof kit.close, 'function');
});
