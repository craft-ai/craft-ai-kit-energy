const debug = require('debug');
const luxon = require('luxon');
const most = require('most');

const Constants = require('./constants');
const Utils = require('./utils');

async function close(providers) {
  return Promise.all(providers.map(async(provider) => {
    await provider.close();
    provider.log('closed');
  }));
}

async function initialize(instance, index) {
  if (instance === null || typeof instance !== 'object')
    throw new TypeError(`The provider at index "${index}" of the kit's configuration is not valid. Received "${instance === null ? 'null' : typeof instance}".`);

  const name = instance.name || index.toString();
  const log = debug(`${DEBUG_PREFIX}:provider:${name}`);
  const constructor = instance.provider || instance;
  const initialize = constructor.initialize;

  log('initializing');

  if (typeof initialize !== 'function' || !isProvider(constructor))
    throw new TypeError(`The provider at index "${index}" of the kit's configuration is not valid.`);

  const prototype = { ...constructor };
  const options = instance.options ? { ...instance.options } : {};

  delete prototype.initialize;

  const refresh = {
    origin: DateTime.utc(2018),
    period: 1
  };

  const provider = Object.create(prototype, {
    context: { value: {} },
    log: { value: log },
    refresh: { value: refresh },
    options: { value: options, enumerable: true },
  });

  await initialize(provider);
  refresh.period = refresh.period * 1000;
  log('initialized');

  return provider;
}

async function extendConfiguration(providers, context) {
  if (!providers.length) return context;

  // TODO: Submit the endpoint's metadata to the providers for validation
  // TODO: Validate the 'refresh' object from the provider
  return Promise.all(
    providers.map((provider) => provider.extendConfiguration())
  ).then((extensions) => Object.assign(context, ...extensions));
}

async function extendConfigurationOption(providers, options) {
  if (!providers.length) return options;

  return Promise
    .all(providers.map((provider) => provider.extendConfigurationOption()))
    .then((extensions) => Object.assign(options, ...extensions));
}

function extendRecords(endpoint, records) {
  const providers = endpoint.kit.configuration.providers;

  if (!providers.length) return records;

  return records
    // Check the providers that have to refresh its output
    .loop((states, record) => {
      const date = record[PARSED_RECORD][DATE];

      const values = states.map((previous, index) => {
        if (previous && previous > date) return;

        const refresh = providers[index].refresh;

        states[index] = Utils.getDateWindow(date, refresh.origin, refresh.period)[1];

        return record;
      });

      return { seed: states, value: [record, values] };
    }, new Array(providers.length).fill(null))
    // Compute the extensions and merge them to the record
    .concatMap((data) => most.fromPromise(Promise
      .all(providers.map((provider, index) => {
        const record = data[1][index];

        return record && provider.extendRecord(endpoint, record);
      }))
      .then((extensions) => Object.assign(data[0], ...extensions, data[0]))));
}

function isProvider(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.initialize === 'function'
    && typeof value.extendConfiguration === 'function' 
    && (typeof value.extendConfigurationOption === 'function' || value.extendConfigurationOption === undefined)
    && typeof value.extendRecord === 'function'
    && typeof value.close === 'function';
}

const DATE = Constants.DATE_FEATURE;
const DEBUG_PREFIX = Constants.DEBUG_PREFIX;
const PARSED_RECORD = Constants.PARSED_RECORD;

const DateTime = luxon.DateTime;

module.exports = {
  close,
  extendConfiguration,
  extendConfigurationOption,
  extendRecords,
  initialize,
};
