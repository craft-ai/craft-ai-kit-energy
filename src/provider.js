const debug = require('debug');
const luxon = require('luxon');
const most = require('most');

const Constants = require('./constants');


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
    origin: { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 },
    timeout: { seconds: 1 }
  };

  const provider = Object.create(prototype, {
    context: { value: {} },
    log: { value: log },
    refresh: { value: refresh },
    options: { value: options, enumerable: true },
  });

  await initialize(provider);
  refresh.timeout = luxon.Duration.fromObject(refresh.timeout);
  log('initialized');

  return provider;
}

async function extendConfiguration(providers, context) {
  if (!providers.length) return context;

  return Promise
    .all(providers.map((provider) => provider.extendConfiguration()))
    .then((extensions) => Object.assign(context, ...extensions));
}

function extendRecords(endpoint, records) {
  const providers = endpoint.kit.configuration.providers;

  if (!providers.length) return records;

  return records
    // Check the providers that have to refresh its output
    .loop((states, record) => {
      const date = record[PARSED_RECORD][DATE];

      const values = states.map((previous, index) => {
        const refresh = providers[index].refresh;
        const timeout = refresh.timeout;
        const interval = getInterval(refresh.origin, timeout, date, previous);

        if (previous && interval.toDuration() < timeout) return;

        states[index] = roundDate(interval, timeout, previous);

        return record[PARSED_RECORD][DATE];
      });

      return { seed: states, value: [record, values] };
    }, new Array(providers.length).fill(null))
    // Compute the extensions and merge them to the record
    .concatMap((data) => most.fromPromise(Promise
      .all(providers.map((provider, index) => {
        const date = data[1][index];

        return date && provider.extendRecord(endpoint, date);
      }))
      .then((extensions) => Object.assign({}, ...extensions, data[0]))));
}


function isProvider(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.initialize === 'function'
    && typeof value.extendConfiguration === 'function'
    && typeof value.extendRecord === 'function'
    && typeof value.close === 'function';
}

function getInterval(origin, duration, date, previous) {
  if (!previous) previous = date.set(origin).minus(duration);

  return previous.until(date);
}

function roundDate(interval, duration, previous) {
  const intervals = interval.splitBy(duration);
  const lastInterval = intervals[intervals.length - 1];

  return previous ? lastInterval.end : lastInterval.start;
}


const DEBUG_PREFIX = Constants.DEBUG_PREFIX;
const PARSED_RECORD = Constants.PARSED_RECORD;
const DATE = Constants.DATE_FEATURE;


module.exports = {
  close,
  extendConfiguration,
  extendRecords,
  initialize,
};
