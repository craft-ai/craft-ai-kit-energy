const seedrandom = require('seedrandom');
const stream = require('stream');
const uuid = require('uuid/v5');

const EnergyKit = require('../src/index');
const Utils = require('../src/utils');


function createContext(t, configuration = {}) {
  return EnergyKit
    .initialize(Object.assign({ recordBulkSize: 1000 }, configuration))
    .then((kit) => {
      const id = t.title;
      const random = seedrandom(id);
      const endpoint = Object.create({ id, all: new Set, register: registerEndpoint, seed: '' });

      t.context = {
        kit, endpoint,
        random(upper) { return Math.floor(random() * (upper + 1)); },
        shuffle(value) {
          const index = random(value.length - 2) + 1;

          return value.slice(index).concat(RECORDS.slice(0, index));
        },
      };
    });
}

function destroyContext(t) {
  const context = t.context;
  const kit = context.kit;
  const client = kit.client;

  return Promise
    .all([...context.endpoint.all].map((id) => client.deleteAgent(id)))
    .then(() => kit.close());
}

function identity(value) { return value; }

function streamify(records) { return new Stream(records); }


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
    const suite = new Error().stack.match(/\/(craft-ai-kit-energy\/.*)\.test\.js/)[1];

    this.seed = `${suite}\n${this.id}`;
  }

  const id = uuid(this.seed, uuid.URL);

  this.seed = id;
  this.all.add(id);

  return id;
}


const INPUT_METHODS = [identity, streamify];
const INVALID_DATES = [false, NaN, 'N/A', 'NaN', 'unknown', '123456', 'string', '5151-51-51T51:51:51.515Z'];
const INVALID_NUMBERS = [null, {}, '12', true, new Date];
const INVALID_OBJECTS = [null, 0, true, 'string', Symbol()];
const RECORDS = require('./data/records');


module.exports = Object.assign({
  createContext,
  destroyContext,
  identity,
  streamify,
  INPUT_METHODS,
  INVALID_DATES,
  INVALID_NUMBERS,
  INVALID_OBJECTS,
  RECORDS,
}, Utils);