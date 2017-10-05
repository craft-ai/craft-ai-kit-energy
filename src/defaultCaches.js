const LRU = require('lru-cache');
const fs = require('fs');

const debug = require('debug')('craft-ai:kit-energy:default-caches');

function createCache(name) {
  const cache = new LRU({
    max: 20000
  });
  return {
    load: (path) => new Promise((resolve, reject) => {
      fs.readFile(path, (err, data) => {
        if (err) {
          const msg = `Error while loading the ${name} cache from '${path}': ${err}.`;
          debug(msg, err);
          reject(new Error(msg));
        }
        try {
          cache.load(JSON.parse(data));
          resolve();
        }
        catch (err) {
          const msg = `Error while deserializing the ${name} cache from '${path}': ${err}.`;
          debug(msg, err);
          reject(new Error(msg));
        }
      });
    }),
    save: (path) => new Promise((resolve, reject) => {
      fs.writeFile(
        path,
        JSON.stringify(cache.dump(), null, '  '),
        (err) => {
          if (err) {
            reject(err);
          }
          else {
            resolve();
          }
        }
      );
    }),
    get: (key) => Promise.resolve(cache.get(key)),
    set: (key, data) => {
      cache.set(key, data);
      return Promise.resolve();
    }
  };
}

function createDefaultWeatherCache() {
  const cache = createCache('weather');
  return {
    load: (path) => cache.load(path),
    save: (path) => cache.save(path),
    get: (lat, lon, timestamp) => cache.get(`${lat},${lon},${timestamp}`),
    set: (lat, lon, timestamp, weather) => cache.set(`${lat},${lon},${timestamp}`, weather)
  };
}

function createDefaultGeolocationCache() {
  const cache = createCache('geolocation');
  return {
    load: (path) => cache.load(path),
    save: (path) => cache.save(path),
    get: (query) => cache.get(JSON.stringify(query)),
    set: (query, location) => cache.set(JSON.stringify(query), location)
  };
}

module.exports = { createDefaultWeatherCache, createDefaultGeolocationCache };
