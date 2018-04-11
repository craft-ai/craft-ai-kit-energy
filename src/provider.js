const debug = require('debug');
const most = require('most');

const Constants = require('./constants');


async function close(providers) {
  return Promise.all(providers.map(async(provider) => {
    await provider.close();
    provider.log('closed');
  }));
}

async function initialize(kit, instance, index) {
  if (instance === null || typeof instance !== 'object')
    throw new TypeError(`The provider at index "${index}" of the kit's configuration is not valid. Received "${instance === null ? 'null' : typeof instance}".`);

  const name = instance.name || index.toString();
  const log = debug(`${DEBUG_PREFIX}:provider:${name}`);
  const prototype = instance.provider || instance;
  const initialize = prototype.initialize;

  log('initializing');

  if (typeof initialize !== 'function' || !isProvider(prototype))
    throw new TypeError(`The provider at index "${index}" of the kit's configuration is not valid.`);

  const provider = Object.create(Object.assign({}, prototype, { initialize: undefined }), {
    kit: { value: kit },
    log: { value: log },
    options: { value: instance.options || {}, enumerable: true },
  });

  await initialize(provider);
  log('initialized');

  return provider;
}

async function extendConfiguration(providers, context) {
  return Promise
    .all(providers.map((provider) => provider.computeConfigurationExtension()))
    .then((extensions) => Object.assign(context, ...extensions));
}

function extendRecords(endpoint, records) {
  const providers = endpoint.kit.configuration.providers;

  return records.concatMap((record) => most.fromPromise(Promise
    .all(providers.map((provider) => provider.computeRecordExtension(endpoint, record[PARSED_DATE])))
    .then((extensions) => Object.assign(record, ...extensions))));
}


function isProvider(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.initialize === 'function'
    && typeof value.computeConfigurationExtension === 'function'
    && typeof value.computeRecordExtension === 'function'
    && typeof value.close === 'function';
}


const DEBUG_PREFIX = Constants.DEBUG_PREFIX;
const PARSED_DATE = Constants.PARSED_DATE;


module.exports = {
  close,
  extendConfiguration,
  extendRecords,
  initialize,
};
