const buffer = require('most-buffer');
const fs = require('fs');
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
test.beforeEach((t) => t.context.token = process.env.DARK_SKY_TOKEN);
test.afterEach.always(Helpers.destroyProviderContext);


test('fails initializing the provider with invalid options', async(t) => {
  const INVALID_TOKENS = [undefined].concat(INVALID_STRINGS, ['']);
  const INVALID_REFRESH_OPTIONS = INVALID_STRINGS.concat(['', 'never']);
  const INVALID_LOAD_FUNCTIONS = INVALID_FUNCTIONS
    .concat([() => ({ key: 'value' }), () => new Map(['key', 'value'])]);

  const token = '*'.repeat(12);

  return Promise.all(INVALID_OBJECTS
    .concat(INVALID_TOKENS.map((token) => ({ token })))
    .concat(INVALID_REFRESH_OPTIONS.map((refresh) => ({ token, refresh })))
    .concat(INVALID_ARRAYS.map((properties) => ({ token, properties })))
    .concat(INVALID_STRINGS.map((property) => ({ token, properties: [property] })))
    .concat(INVALID_OBJECTS.map((cache) => ({ token, cache })))
    .concat(INVALID_NUMBERS.map((size) => ({ token, cache: { size } })))
    .concat(INVALID_FUNCTIONS.map((save) => ({ token, cache: { save } })))
    .concat(INVALID_LOAD_FUNCTIONS.map((load) => ({ token, cache: { load } })))
    .map((options) => t.throwsAsync(Provider.initialize({ provider: WeatherProvider, options }, 0))))
    .then((a) => t.snapshot(a));
});

test('initializes the provider', (t) => {
  return Helpers
    .createProviderContext(t, WeatherProvider, { token: t.context.token })
    .then(() => t.snapshot(t.context.provider));
});

test('computes the configuration\'s extension', (t) => {
  return Helpers
    .createProviderContext(t, WeatherProvider, { token: t.context.token })
    .then(() => t.context.provider.extendConfiguration())
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.snapshot(extension);
    });
});

test('computes the configuration\'s extension with custom properties', async(t) => {
  return Helpers
    .createProviderContext(t, WeatherProvider, {
      token: t.context.token,
      properties: ['icon']
    })
    .then(() => t.context.provider.extendConfiguration())
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.snapshot(extension);
    });
});

test('computes the record\'s extension in Paris', async(t) => {
  await Helpers.createProviderContext(t, WeatherProvider, { token: t.context.token });

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
    .observe((records) => t.snapshot(records));
});

test('computes the record\'s extension in Annecy daily', async(t) => {
  await Helpers.createProviderContext(t, WeatherProvider, {
    token: t.context.token,
    refresh: 'daily',
    cache: { save: saveCache.bind(null, t.title) }
  });

  const provider = t.context.provider;

  interceptWeatherRequest(provider, t.title);

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
    .observe((records) => t.snapshot(records));
});

test('computes the record\'s extension in Angers hourly with cache', async(t) => {
  await Helpers.createProviderContext(t, WeatherProvider, {
    token: t.context.token,
    properties: ['icon', 'temperature'],
    refresh: 'hourly',
    cache: {
      load: loadCache.bind(null, t.title),
      save: saveCache.bind(null, t.title)
    }
  });

  const provider = t.context.provider;

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
    .observe((records) => t.snapshot(records));
});

test('closes the provider', (t) => {
  return Provider
    .initialize({ provider: WeatherProvider, options: { token: t.context.token } }, 0)
    .then((provider) => t.notThrowsAsync(provider.close()));
});


async function saveCache(title, entries) {
  if (!entries.length) return;

  const filepath = path.join(CACHE_DIRECTORY, `${getCacheName(title)}.json`);

  fs.writeFileSync(filepath, JSON.stringify(entries));
}

function loadCache(title) {
  try {
    return require(`../helpers/cache/${getCacheName(title)}.json`);
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
}

function interceptWeatherRequest(provider, title) {
  const cache = loadCache(title);

  if (!cache || !cache.length) return;

  const urlParts = provider.context.baseUrl.replace('https://', '').split('/');
  const hostname = `https://${urlParts.shift()}`;
  const basePath = `/${urlParts.join('/')}`;
  const refresh = provider.options.refresh;

  cache.reduce((scope, entry) => {
    const resource = entry[0];
    const value = entry[1];

    return scope
      .get(basePath + resource)
      .query(true)
      .reply(200, { [refresh]: { data: [{ time: +resource.split(',').slice(-1)[0], ...value }] } });
  }, nock(hostname, { allowUnmocked: true }));
}

function getCacheName(title) {
  return uuid(title, uuid.URL);
}


const DATE = Constants.DATE_FEATURE;
const LOAD = Constants.LOAD_FEATURE;
const INVALID_ARRAYS = Helpers.INVALID_ARRAYS;
const INVALID_FUNCTIONS = Helpers.INVALID_FUNCTIONS;
const INVALID_NUMBERS = Helpers.INVALID_NUMBERS;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const INVALID_STRINGS = Helpers.INVALID_STRINGS;
const WINDOW_START = luxon.DateTime.local(2018, 4, 1, 0, 15);
const CACHE_DIRECTORY = path.join(__dirname, '../helpers/cache');
const WINDOW = new Array(7 * 24)
  .fill(null)
  .map((_, hours) => ({ [DATE]: WINDOW_START.plus({ hours }), [LOAD]: 0 }));
const DAILY_WINDOW = WINDOW.filter((_, index) => !(index % 24));
