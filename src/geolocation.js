const csv = require('fast-csv');
const fs = require('fs');
const path = require('path');
const { create } = require('@most/create');
const { first } = require('most-nth');
const { createDefaultGeolocationCache } = require('./defaultCaches');

const DATAFILE_PATH = path.join(__dirname, '../data/geoloc.csv');

function readCsvStream(dataset) {
  return create((add, end, error) => {
    const stream = fs.createReadStream(dataset);
    const csvStream = csv({ headers: true, ignoreEmpty: true, delimiter: ',' });
    csvStream.on('data', (data) => add(data));
    csvStream.on('end', () => end());
    stream.pipe(csvStream);
  });
}

function createGeolocationClient(cache) {
  cache = cache || createDefaultGeolocationCache();

  return {
    cache,
    locate: ({ postalCode } = {}) => {
      if (!postalCode) {
        return Promise.reject(new Error('Unable to perform the geolocation when no postalCode is provided.'));
      }
      return cache.get({ postalCode })
        .then((cachedLocation) => {
          if (cachedLocation) {
            return cachedLocation;
          }
          else {
            return readCsvStream(DATAFILE_PATH)
            // Along the way, keep in the memory cache
              .tap((entry) => cache.set({ postalCode: entry.postalCode }, entry))
            // Filter the matching entries
              .filter((entry) => entry.postalCode === postalCode)
            // Take the first match
              .thru(first)
              .then((location) => {
                if (!location) {
                  return Promise.reject(new Error(`Unable to find a valid location for the given postal code '${postalCode}'.`));
                }
                return location;
              });
          }
        });
    }
  };
}

module.exports = createGeolocationClient;
