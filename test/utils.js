const uuid = require('uuid/v5');

const EnergyKit = require('../src/index');


function createContext(t) {
  return EnergyKit
    .initialize()
    .then((kit) => {
      const endpoint = Object.create({
        id: t.title,
        all: new Set,
        register: registerEndpoint,
        seed: '',
      });

      t.context = { kit, endpoint };
    });
}

function destroyContext(t) {
  const context = t.context;

  return Promise.all([...context.endpoint.all].map((id) => context.kit.client.deleteAgent(id)));
}


function registerEndpoint() {
  if (!this.seed) {
    const suite = new Error().stack.match(/\/(craft-ai-kit-energy\/.*)\.test\.js/)[1];

    this.seed = `${suite}\n${this.id}`;
  }

  const id = uuid(this.seed, uuid.URL);

  this.seed = id;
  this.all.add(id);

  return id;
}


module.exports = {
  createContext,
  destroyContext,
};
