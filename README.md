# craft ai energy kit #

> :construction: Under construction

[![Version](https://img.shields.io/npm/v/craft-ai-kit-energy.svg?style=flat-square)](https://npmjs.org/package/craft-ai-kit-energy) [![Build](https://img.shields.io/travis/craft-ai/craft-ai-kit-energy/master.svg?style=flat-square)](https://travis-ci.org/craft-ai/craft-ai-kit-energy) [![License](https://img.shields.io/badge/license-BSD--3--Clause-42358A.svg?style=flat-square)](LICENSE) [![Dependencies](https://img.shields.io/david/craft-ai/craft-ai-kit-energy.svg?style=flat-square)](https://david-dm.org/craft-ai/craft-ai-kit-energy) [![Dev Dependencies](https://img.shields.io/david/dev/craft-ai/craft-ai-kit-energy.svg?style=flat-square)](https://david-dm.org/craft-ai/craft-ai-kit-energy#info=devDependencies)

> :warning: this repository rely on [git LFS](https://git-lfs.github.com)

## Attribution ##

[![Powered By Dark Sky](./poweredby_dark_sky.png)](https://darksky.net/poweredby/)

## Usage ##

This integration kit has been developed using Node.JS v6.9.1, it should work with any later Node.JS v6.X version.

### Create the kit ###

The kit uses the following **environment variables** for secrets and global configuration.

 - `DEBUG` can be used to select the logs that you want to display, set it to 'craft-ai:*' for all the logs related to **craft ai**.

With this environment variable set, create the kit like that:

```js
const createEnergyKit = require('path/to/this/directory/src');

const kit = createEnergyKit({
  // Mandatory, the craft ai token for the project the kit will use.
  token: '{craft-ai-token}',
  // Mandatory, the DarkSky secret key used to retrieve weather information, ou can retrieve your key at <https://darksky.net/dev/account>.
  darkSkySecretKey: '{DarkSky-secret-key}',
  // **Optional**
  // Cache to avoid duplicate calls to Dark Sky, a default in-memory cache
  // is used when none is provided.
  weatherCache: {
    set: // (lat, lon, timestamp, weather) -> Promise()
    get: // (lat, lon, timestamp) -> Promise(weather)
  },
  // The confidence threshold under which predictions are not considered.
  // Its default value is 0.4
  confidenceThreshold: '{prediction-confidence-threshold}',
  // The maximum relative deviation to the predicted load for a prediction to be considered 'valid'
  // This number is expressed in amount of standard deviations, its default value is 2.
  relativeDeviationThreshold: '{relative-deviation-threshold}',
  // The maximum deviation to the predicted load for a prediction to be considered 'valid', in Watts.
  // By default, this threshold is not set.
  absoluteDeviationThreshold: '{absolute-deviation-threshold}'
});
```

### Functions ###

> All the functions exposed by the kit return es2015 [**Promises**](http://www.datchley.name/es6-promises/).


> Take a look at `main.js` to get a working example of the kit.


#### `User` datastructure ####

To identify and retrieve metadata for a user the kit uses the following `user` data structure:

```js
{
  id: '123456', // A unique identifier for the user
  location: {
    postalCode: '75013', // The postal code for this user
    lat: '...', // The latitude and longitude for this user (based on his postal code), set by the kit.update(...) function
    lon: '...'
  },
  agentId: '...', // The unique craft ai agent id, set by the kit.update(...) function
  firstTimestamp, ... // The unix timestamp of the first sent data.
  lastTimestamp: ... // The unix timestamp of the last sent data.
}
```

#### `DataPoint` datastructure ####

The data given to the kit follows the given format:

```js
{
  date: '2017-09-21T12:00+02:00', // The date, as a string, a JavaScript Date or a Unix Timestamp.
  load: 1234, // The load, in Watts
  tempMin: 123, // Mandatory if no `cfg.darkSkySecretKey` is provided, the minimum temperature in Degree Celsius
  tempMax: 345, // Mandatory if no `cfg.darkSkySecretKey` is provided, the maximum temperature in Degree Celsius
}
```

### `kit.update(user: User, data: Array<DataPoint>)` ###

Update the `user` with new data, this creates craft ai agents as needed.

### `kit.delete(user: User)` ###

Deletes the given `user`.

### `kit.computeAnomalies(user: User, { from: Date, to: Date })` ###

Computes the 'abnormal' energy consumption for the given `user` during the given timeframe.

### `kit.validate(user: User, { window: DurationInSeconds, windowsCount: Integer })` ###

Validate the prediction model for a given `user` following the given window size, over the last `windowsCount` windows.

The default value for `window` is one week, the default value for `windowsCount` is -1 which means enough window to fill the lifetime of the user.

### `kit.predict(user: User, { from: Date, to: Date })` ###

Compute load predictions for the given `user` during the given timeframe.

### `kit.terminate()` ###

Should be called at the end of the work.
