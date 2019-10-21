const debug = require('debug');
const luxon = require('luxon');
const most = require('most');
const isFunction = require('lodash.isfunction');

const Constants = require('./constants');
const Utils = require('./utils');

async function close(providers) {
  /*
  Close a list of providers.

  *************
  **Arguments**
  *************
  providers: Array of providers.
  */
  return Promise.all(providers.map(async(provider) => {
    await provider.close();
    provider.log('closed');
  }));
}

async function initialize(instance, index) {
  /*
  Initialize a provider.

  *************
  **Arguments**
  *************
  instance: Object
    - name: String optional, name of the provider. Default is the string version of index
    - options: Object optional: contain the options for the provider
    - provider: Object that is a provider (isProvider is true).
  index: positive integer, index of the particular provider

  **********
  **Return**
  **********
  An object Provider
  */
  if (instance === null || typeof instance !== 'object')
    throw new TypeError(`The provider at index "${index}" of the kit's configuration is not valid. Received "${instance === null ? 'null' : typeof instance}".`);

  const name = instance.name || index.toString();
  const log = debug(`${DEBUG_PREFIX}:provider:${name}`);
  const constructor = instance.provider || instance;
  const initialize = constructor.initialize;

  log('initializing');

  if (!isFunction(initialize) || !isProvider(constructor))
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
  /*
  Extend the craft ai context of an agent using providers.

  *************
  **Arguments**
  *************
  providers: Array of Provider that have the function extendConfiguration
  that return an object with the context properties to add.
  context: Object, context properties to add to the agent's context.

  **********
  **Return**
  **********
  craft ai agent's context
  */
  if (!providers.length) return context;

  // TODO: Submit the endpoint's metadata to the providers for validation
  // TODO: Validate the 'refresh' object from the provider
  return Promise.all(
    providers.map((provider) => provider.extendConfiguration())
  ).then((extensions) => Object.assign(context, ...extensions));
}

function extendRecords(endpoint, records) {
  /*
  Extend the data/records using providers.
  
  *************
  **Arguments**
  *************
  endpoint: Endpoint (Object). It should contains:
    - kit.configuration.providers: Array of Providers that have the function
    extendRecords
  records: Object, data to extend

  **********
  **Return**
  **********
  Extended record
  */
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
  /*
  Check if the value parsed is a provider
  
  *************
  **Arguments**
  *************
  value: value to test.

  **********
  **Return**
  **********
  Boolean
  */
  return value !== null
    && typeof value === 'object'
    && typeof value.initialize === 'function'
    && typeof value.extendConfiguration === 'function'
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
  extendRecords,
  initialize,
};
