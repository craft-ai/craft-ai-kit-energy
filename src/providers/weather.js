const fetch = require('node-fetch');
const lru = require('quick-lru');
const retry = require('p-retry');

const Constants = require('../constants');
const Utils = require('../utils');


async function initialize(provider) {
  const options = provider.options;
  const token = options.token;

  if (typeof token !== 'string')
    throw new TypeError(`The "token" option of the weather provider must be a "string". Received "${typeof token}".`);
  if (!token)
    throw new RangeError(`The "token" option of the weather provider must be valid. Received "${token}".`);

  // Avoid printing the token when logging the provider
  Object.defineProperty(options, 'token', { enumerable: false });

  const context = provider.context;
  const refresh = options.refresh;

  if (refresh !== undefined) {
    if (typeof refresh !== 'string')
      throw new TypeError(`The "refresh" option of the weather provider must be a "string". Received "${typeof refresh}".`);
    if (!POSSIBLE_REFRESH_VALUES.includes(refresh))
      throw new RangeError(`The "refresh" option of the weather provider must be one of: "${POSSIBLE_REFRESH_VALUES.join('", "')}". Received "${refresh}".`);

    provider.refresh.timeout = { [refresh === 'hourly' ? 'hours' : 'days']: 1 };
  } else {
    options.refresh = 'daily';
    provider.refresh.timeout = { days: 1 };
  }

  const properties = options.properties;

  if (properties !== undefined) {
    if (!Array.isArray(properties))
      throw new TypeError(`The "properties" option of the weather provider must be an "array". Received "${typeof properties}".`);
    if (properties.some(Utils.isNotString))
      throw new TypeError(`The "properties" option of the weather provider must only contain "string" value (see https://darksky.net/dev/docs#data-block for a list of available properties). Received ${JSON.stringify(JSON.stringify(properties))}.`);
  } else options.properties = ['temperatureLow', 'temperatureHigh'];

  const exclude = POSSIBLE_REFRESH_VALUES
    .filter((value) => value !== options.refresh)
    .concat(['currently', 'minutely', 'flags', 'alerts'])
    .join(',');

  context.cache = new lru({ maxSize: 10000 });
  context.baseUrl = `https://api.darksky.net/forecast/${token}/`;
  context.queryOptions = `?lang=en&units=si&exclude=${exclude}&extend=hourly`;
  context.enumProperties = ['icon', 'precipType'];
}

async function extendConfiguration() {
  return this.options.properties.reduce(generateConfiguration, {});
}

async function extendRecord(endpoint, record) {
  const metadata = endpoint.metadata;
  const context = this.context;
  const cache = context.cache;
  const position = `${metadata.latitude},${metadata.longitude}`;
  const resource = `${position},${record[DATE]}`;

  if (cache.has(resource)) return cache.get(resource);

  const query = context.baseUrl + resource + context.queryOptions;

  return retry(() => fetch(query).then(Utils.checkResponse), RETRY_OPTIONS)
    .then(handleResponse)
    .then((data) => {
      const options = this.options;
      const key = options.refresh;
      const dataPoints = key in data && data[key].data;

      /* istanbul ignore next */
      if (!dataPoints || !dataPoints.length) return;

      const properties = options.properties;

      const results = dataPoints.map((dataPoint) => {
        const result = properties.reduce((result, property) => {
          result[property] = dataPoint[property];

          return result;
        }, {});

        cache.set(`${position},${dataPoint.time}`, result);

        return result;
      });

      return results[0];
    });
}

async function close() {
  // Clear the cache
  this.context.cache.clear();
}


async function handleResponse(response) {
  /* istanbul ignore next */
  return response.status < 400 ? response.json() : Promise.reject(response);
}

function generateConfiguration(extension, property) {
  extension[property] = { type: ENUM_PROPERTIES.includes(property) ? 'enum' : 'continuous' };

  return extension;
}


const DATE = Constants.DATE_FEATURE;
const RETRY_OPTIONS = { retries: 5, minTimeout: 100 };
const POSSIBLE_REFRESH_VALUES = ['hourly', 'daily'];
const ENUM_PROPERTIES = ['icon', 'precipType'];


module.exports = {
  close,
  extendConfiguration,
  extendRecord,
  initialize,
};
