const buffer = require('most-buffer');
const fs = require('fs');
const lru = require('quick-lru');
const luxon = require('luxon');
const most = require('most');
const nock = require('nock');
const path = require('path');
const test = require('ava');
const uuid = require('uuid/v5');

const Common = require('../../src/endpoint/common');
const Constants = require('../../src/constants');
const Helpers = require('../helpers');
const Provider = require('../../src/provider');
const WeatherProvider = require('../../src/providers/weather');


test.before(require('dotenv').load);
test.beforeEach((t) => Helpers.createProviderContext(t, WeatherProvider, { token: process.env.DARK_SKY_TOKEN }));
test.afterEach.always(Helpers.destroyProviderContext);


test('fails initializing the provider with invalid options', (t) => {
  const INVALID_TOKENS = [undefined].concat(INVALID_STRINGS, ['']);
  const INVALID_REFRESH_OPTIONS = INVALID_STRINGS.concat(['', 'never']);

  const token = '*'.repeat(12);

  return Promise.all(INVALID_OBJECTS
    .concat(INVALID_TOKENS.map((token) => ({ token })))
    .concat(INVALID_REFRESH_OPTIONS.map((refresh) => ({ token, refresh })))
    .concat(INVALID_ARRAYS.map((properties) => ({ token, properties })))
    .concat(INVALID_STRINGS.map((property) => ({ token, properties: [property] })))
    .map((options) => t.throws(Provider.initialize({ provider: WeatherProvider, options }, 0))))
    .then((a) => t.snapshot(a));
});

test('initializes the provider', (t) => {
  return t.snapshot(t.context.provider);
});

test('computes the configuration\'s extension', (t) => {
  return t.context.provider
    .extendConfiguration()
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.snapshot(extension);
    });
});

test('computes the configuration\'s extension with custom properties', (t) => {
  return Provider
    .initialize({
      provider: WeatherProvider,
      options: { token: t.context.provider.options.token, properties: ['icon'] }
    }, 0)
    .then((provider) => provider.extendConfiguration())
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.snapshot(extension);
    });
});

test('computes the record\'s extension in Paris', (t) => {
  const provider = t.context.provider;

  interceptWeatherRequest(provider, t.title);

  return Common
    .toRecordStream(DAILY_WINDOW)
    .concatMap((record) => most.fromPromise(provider
      .extendRecord({ metadata: { latitude: 48.85341, longitude: 2.3488 } }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');

        return extension;
      })))
    .thru(buffer())
    .observe((records) => {
      t.snapshot(records);
      persistWeatherCache(provider.context.cache, t.title);
    });
});

test('computes the record\'s extension in Annecy daily', async(t) => {
  const provider = await Provider.initialize({
    provider: WeatherProvider,
    options: {
      token: t.context.provider.options.token,
      refresh: 'daily'
    }
  }, 0);

  interceptWeatherRequest(provider, t.title);
  t.context.provider = provider;

  return Common
    .toRecordStream(DAILY_WINDOW)
    .concatMap((record) => most.fromPromise(provider
      .extendRecord({ metadata: { latitude: 45.8898, longitude: 6.1355 } }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');

        return extension;
      })))
    .thru(buffer())
    .observe((records) => t.snapshot(records))
    .then(() => persistWeatherCache(provider.context.cache, t.title));
});

test('computes the record\'s extension in Angers hourly with cache', async(t) => {
  const provider = await Provider.initialize({
    provider: WeatherProvider,
    options: {
      token: t.context.provider.options.token,
      properties: ['icon', 'temperature'],
      refresh: 'hourly'
    }
  }, 0);

  provider.context.cache = loadWeatherCache(t.title);
  t.context.provider = provider;

  return Common
    .toRecordStream(WINDOW)
    .concatMap((record) => most.fromPromise(provider
      .extendRecord({ metadata: { latitude: 47.474, longitude: -0.5516 } }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');

        return extension;
      })))
    .thru(buffer())
    .observe((records) => t.snapshot(records))
    .then(() => persistWeatherCache(provider.context.cache, t.title));
});

test('closes the provider', (t) => {
  return t.notThrows(t.context.provider.close());
});


async function persistWeatherCache(cache, title) {
  const keys = [...cache.keys()];

  if (!keys.length) return;

  const filepath = path.join(CACHE_DIRECTORY, `${getCacheName(title)}.json`);
  const entries = keys.map((key) => [key, cache.get(key)]);

  fs.writeFileSync(filepath, JSON.stringify(entries));
}

function loadWeatherCache(title) {
  try {
    const entries = require(`../helpers/cache/${getCacheName(title)}.json`);
    const cache = new lru({ maxSize: 10000 });

    entries.forEach((entry) => cache.set(...entry));

    return cache;
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
}

function interceptWeatherRequest(provider, title) {
  const cache = loadWeatherCache(title);

  if (!cache) return;

  const resources = [...cache.keys()];

  if (!resources.length) return;

  const urlParts = provider.context.baseUrl.replace('https://', '').split('/');
  const hostname = `https://${urlParts.shift()}`;
  const basePath = `/${urlParts.join('/')}`;
  const refresh = provider.options.refresh;
  const scope = nock(hostname, { allowUnmocked: true });

  resources.forEach((resource) => scope
    .get(basePath + resource)
    .query(true)
    .reply(200, { [refresh]: { data: [{ time: +resource.split(',').slice(-1)[0], ...cache.get(resource) }] } }));
}

function getCacheName(title) {
  return uuid(title, uuid.URL);
}


const DATE = Constants.DATE_FEATURE;
const LOAD = Constants.LOAD_FEATURE;
const INVALID_ARRAYS = Helpers.INVALID_ARRAYS;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const INVALID_STRINGS = Helpers.INVALID_STRINGS;
const WINDOW_START = luxon.DateTime.local(2018, 4);
const CACHE_DIRECTORY = path.join(__dirname, '../helpers/cache');
const WINDOW = new Array(7 * 24)
  .fill(null)
  .map((_, hours) => ({ [DATE]: WINDOW_START.plus({ hours }), [LOAD]: 0 }));
const DAILY_WINDOW = WINDOW.filter((_, index) => !(index % 24));
