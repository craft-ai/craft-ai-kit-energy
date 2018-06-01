const test = require('ava');

const Helpers = require('../helpers');


test.before(require('dotenv').load);
test.beforeEach(Helpers.createContext);
test.afterEach.always(Helpers.destroyContext);


test('destroys the endpoint\'s related agent', (t) => {
  const context = t.context;
  const kit = context.kit;

  return kit
    .loadEndpoint({ id: context.endpoint.register() })
    .then((endpoint) => endpoint
      .destroy()
      .then((result) => t.falsy(result))
      .then(() => t.throws(kit.client.getAgent(endpoint.agentId))));
});
