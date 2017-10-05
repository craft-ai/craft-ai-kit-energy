const moment = require('moment-timezone');
const { createDefaultWeatherCache } = require('./defaultCaches');
const fetch = require('node-fetch');

const debug = require('debug')('craft-ai:kit-energy:weather');

function createWeatherClient({ cache, darkSkySecretKey }) {
  if (!darkSkySecretKey) {
    throw new Error('Unable to create the weather client with no DarkSky Secret Key provided.');
  }
  cache = cache || createDefaultWeatherCache();
  const rootUrl = `https://api.darksky.net/forecast/${darkSkySecretKey}/`;
  const retrieveRawWeather = (lat, lon, timestamp) => {
    return cache.get(lat, lon, timestamp)
      .then((cachedRawWeather) => {
        if (cachedRawWeather) {
          return cachedRawWeather;
        }
        else {
          const url = `${rootUrl}${lat},${lon},${timestamp}?units=si`;
          debug(`Retrieving weather information from DarkSky at '${url}'...`);
          return fetch(url)
            .then((res) => {
              if (res.status >= 400) {
                return Promise.reject(new Error(`DarkSky: HTTP error ${res.status} when calling GET ${url}.`));
              }
              else {
                return res.json();
              }
            })
            .then((rawWeather) => cache.set(lat, lon, timestamp, rawWeather).then(() => rawWeather));
        }
      });
  };
  return {
    cache,
    darkSkySecretKey,
    computeDailyWeather: ({ lat, lon, timestamp, timezone }) => {
      const m = moment.unix(timestamp).utcOffset(timezone).hours(6).minutes(0).seconds(0);
      return retrieveRawWeather(lat, lon, m.unix())
        .then((rawWeather) => {
          const weather = {
            temperatureMin: rawWeather.daily.data[0].temperatureMin,
            temperatureMax: rawWeather.daily.data[0].temperatureMax,
            cloudCover: rawWeather.daily.data[0].cloudCover,
            pressure: rawWeather.daily.data[0].pressure
          };
          return weather;
        });
    }
  };
}

module.exports = createWeatherClient;
