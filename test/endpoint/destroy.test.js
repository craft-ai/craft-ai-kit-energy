const test = require('ava');

const Utils = require('../utils');


test.before(require('dotenv').load);
test.beforeEach(Utils.createContext);
test.afterEach.always(Utils.destroyContext);


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
