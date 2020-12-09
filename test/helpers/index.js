const seedrandom = require('seedrandom');
const stream = require('stream');
const uuid = require('uuid/v5');

const EnergyKit = require('../../src/index');
const Provider = require('../../src/provider');
const Utils = require('../../src/utils');

const ZONES = ['gmt', 'utc', 'utc-3', 'utc+3', 'utc-03:30', 'America/Chihuahua', 'Europe/Paris', 'Asia/Kolkata', 'Antarctica/South_Pole'];
const INVALID_ARRAYS = [null, 0, true, 'string', Symbol(), new Uint8Array(10), () => {}];
const INVALID_BOOLEANS = ['true', [1], [0], 'false', {}, null];
const INVALID_DATES = [false, NaN, 'N/A', 'NaN', 'unknown', 'string', '5151-51-51T51:51:51.515Z', () => {}];
const INVALID_FUNCTIONS = [null, {}, 'abc', Boolean(), Array.from(2), new Date(2018)];
const INVALID_ZONES = [null, false, 2, 'Europe/Taipei', 'America/Madrid'];
const INVALID_NUMBERS = [null, {}, '12', true, new Date(2018), () => {}];
const INVALID_OBJECTS = [null, 0, true, 'string', Symbol(), () => {}];
const INVALID_STRINGS = [null, {}, [false], true, new Date(2018), Promise.resolve('string'), () => {}];
const PERIOD_ORIGINS = ['2018-01-01'/*, '2020-12-31T00:00:00.000Z', new Date('Fri Jan 01 2016 00:00:00 GMT+0100 (Central European Standard Time)'), 1543446000000*/];
const RECORDS = require('./data/records');
const RECORDS_AS_ENERGY = require('./data/records_energy');
const RECORDS_AS_ACCUMULATED_ENERGY = require('./data/records_accumulated_energy');
const RECORDS_AS_ACCUMULATED_ENERGY_DST = require('./data/records_accumulated_energy_dst');
const RECORDS_DST = require('./data/records_dst');

async function createEndpointContext(t, configuration = {}) {
  return EnergyKit
    .initialize({ ...configuration, recordBulkSize: 1000 })
    .then((kit) => {
      const id = t.title;
      const context = t.context;
      const random = seedrandom(id);

      context.kit = kit;
      context.endpoint = Object.create({ id, all: new Set, register: registerEndpoint, seed: '' });
      context.random = randomInteger;
      context.shuffle = shuffle;

      function randomInteger(upper) {
        return Math.floor(random() * (upper + 1));
      }

      function shuffle(value) {
        const index = randomInteger(value.length - 2) + 1;

        return value.slice(index)
          .concat(RECORDS.slice(0, index));
      }
    });
}

async function createProviderContext(t, provider, options = {}) {
  return Provider
    .initialize({ provider, options }, 0)
    .then((provider) => t.context.provider = provider);
}

async function destroyEndpointContext(t) {
  const context = t.context;
  const kit = context.kit;

  if (!kit) {
    return;
  }

  const client = kit.client;

  return Promise
    .all([...context.endpoint.all].map((id) => client.deleteAgent(id)))
    .then(() => kit.close());
}

async function destroyProviderContext(t) {
  const provider = t.context.provider;

  return provider && provider.close();
}

function identity(value) {
  return value;
}

function streamify(records) {
  return new Stream(records);
}

class Stream extends stream.Readable {
  constructor(records) {
    super({ objectMode: true });

    this.records = records;
    this.index = 0;
  }

  _read() {
    const records = this.records;

    this.push(this.index === records.length ? null : records[this.index++]);
  }
}

function registerEndpoint() {
  if (!this.seed) {
    const suite = new Error().stack
      // Replace Windows directory separator with Linux one preventing snapshot mismatch.
      .replace(/\\/g, '/')
      .match(/\/(craft-ai-kit-energy\/.*)\.test\.js/)[1];

    this.seed = `${suite}\n${this.id}`;
  }

  const id = uuid(this.seed, uuid.URL);

  this.seed = id;
  this.all.add(id);

  return id;
}

module.exports = {
  ...Utils,
  createEndpointContext,
  createProviderContext,
  destroyEndpointContext,
  destroyProviderContext,
  identity,
  streamify,
  ZONES,
  INVALID_ARRAYS,
  INVALID_BOOLEANS,
  INVALID_DATES,
  INVALID_FUNCTIONS,
  INVALID_ZONES,
  INVALID_NUMBERS,
  INVALID_OBJECTS,
  INVALID_STRINGS,
  PERIOD_ORIGINS,
  RECORDS,
  RECORDS_AS_ENERGY,
  RECORDS_AS_ACCUMULATED_ENERGY,
  RECORDS_AS_ACCUMULATED_ENERGY_DST,
  RECORDS_DST
};
