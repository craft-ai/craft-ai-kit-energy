# craft ai energy kit #

> :construction: Under construction

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
  // Optional
  // Cache to avoid duplicate calls to Dark Sky, a default in-memory cache
  // is used when none is provided.
  weatherCache: {
    set: // (lat, lon, timestamp, weather) -> Promise()
    get: // (lat, lon, timestamp) -> Promise(weather)
  }
});
```

### Functions ###

> All the functions exposed by the kit return es2015 [**Promises**](http://www.datchley.name/es6-promises/).


> Take a look at `main.js` to get a working example of the kit.


#### `user` datastructure ####

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
  lastTimestamp: ... // The unix timestamp of the last sent data.
}
```

### `kit.update` ###

Update the `user` with new data, this creates craft ai agents as needed.

### `kit.delete` ###

Deletes the given `user`.

### `kit.computeAnomalies` ###

Computes the 'abnormal' energy consumption for the given `user` during the given timeframe.

### `kit.terminate` ###

Should be called at the end of the work.
