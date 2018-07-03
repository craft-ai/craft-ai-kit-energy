# craft ai energy kit #

> The [craft ai] integration kit for energy prediction in JavaScript.

> :construction: This project is still under active development.

[![Version](https://img.shields.io/npm/v/craft-ai-kit-energy.svg?style=flat-square)](https://npmjs.org/package/craft-ai-kit-energy)
[![Build](https://img.shields.io/travis/craft-ai/craft-ai-kit-energy/master.svg?style=flat-square)](https://travis-ci.org/craft-ai/craft-ai-kit-energy)
[![License](https://img.shields.io/badge/license-BSD--3--Clause-42358A.svg?style=flat-square)](LICENSE)
[![Dependencies](https://img.shields.io/david/craft-ai/craft-ai-kit-energy.svg?style=flat-square)](https://david-dm.org/craft-ai/craft-ai-kit-energy)
[![Dev Dependencies](https://img.shields.io/david/dev/craft-ai/craft-ai-kit-energy.svg?style=flat-square)](https://david-dm.org/craft-ai/craft-ai-kit-energy#info=devDependencies)

## Usage ##

This integration kit has been tested on every active and maintained [`LTS` releases of Node.js](https://github.com/nodejs/Release#release-schedule) (i.e. it should work with any version greater or equal to `v6.9.0`).

#### Add the energy kit to your project ####

```console
$ npm i craft-ai-kit-energy
```

#### Initialize an instance of the kit ####

> All the functions exposed by the kit return native [**Promises**](http://www.datchley.name/es6-promises/).

```js
const EnergyKit = require('craft-ai-kit-energy');

EnergyKit
  .initialize({
    /**
     * __Required__
     *
     * Specify the craft ai token with write access to a project. The kit will
     * use this project to host its agents. You can also specify it through the
     * environment variables `CRAFT_AI_TOKEN`.
     */
    token: '{the-craft-ai-token}',
    /**
     * __Recommended in a production environnement.__
     *
     * Define a string used to derive and anonymise the unique identifiers of
     * an endpoint when creating the related craft ai agents. If not specified,
     * each agent will use the same identifier as the endpoint's identifier.
     */
    secret: '{a-secret-string}'
  })
  .then((kit) => /* Do something with the kit... */);
```

#### Load an endpoint ####

One instance of the kit can manage several electrical equipments, they are called _endpoints_. They need at least a unique identifier to be loaded.

```js
kit
  .loadEndpoint({
    /**
     * __Required__
     *
     * Define uniquely the endpoint.
     */
    id: '{a-unique-id}'
  })
  .then((endpoint) => /* Do something with the endpoint... */)
```

#### Update the endpoint ###

Before using the endpoint, you might want to update it with load consumption data.
The endpoint takes as an input a _record_, which consists at least of a dated eletrical load information.

```js
endpoint
  .update([
    { date: new Date(2018, 0, 1), load: 740 },
    { date: new Date(2018, 0, 2), load: 415 },
    { date: new Date(2018, 0, 3), load: 609 },
    /* ... */
    { date: new Date(), load: 286 },
  ])
  .then((endpoint) => /* Do something with the updated endpoint... */)
```

#### Harness the endpoint's predictive model ####

Once your endpoint instance is up-to-date, you can make use of its underlying predictive model to retrieve for example a list of consumption anomalies.

> For a complete list of available methods, refer to [the API reference](#api-reference).

```js
const today = new Date()
const lastMonth = new Date(today - 30 * 24 * 3600 * 1000)

endpoint
  .computeAnomalies({ from: lastMonth, to: today })
  .then((anomalies) => console.log(anomalies))
```

#### Close the kit ####

When you're done using the kit, close it:

```js
kit
  .close()
  .then(() => /* Do something after the kit has been closed... */)
```

#### Adding additional context information ####

In most cases, the endpoint's consumption doesn't only depends on time. You might want to boost the underlying predictive model with weather information or holidays.

> This feature is not documented yet. Contact us or jump into the code, for more information.

### API reference ###

#### `endpoint.computeAnomalies({ from: Date, to: Date })` ####

Detect the anomalies for mean electrical load based on the stored history of the endpoint in a given range of time.

#### `endpoint.computePredictions(Array<State>)` ####

> A state consists in records object without the electrical data.

Retrieve the predictions of mean electrical load for a set of states.

#### `endpoint.computeReport({ from: Date, to: Date })` ####

Retrieve some statistics for mean electrical load based on the stored history of the endpoint in a given range of time.

#### `endpoint.destroy()` ####

Delete the endpoint, all its stored records from the related craft ai agent as well as the agent itself.

#### `endpoint.retrievePredictiveModel(modelDate?: Date)` ####

Retrieve the craft ai predictive model at a given date. By default, the model based on the last stored endpoint's records will be downloaded.

#### `endpoint.retrieveRecords(from: Date, to: Date)` ####

Retrieve the stored endpoint's records from the related craft ai agent.

#### `endpoint.update(Array<Record>)` ####

Update the endpoint by adding the new records to the related craft ai agent. Older records than the one already stored on the agent are simply ignored.

#### Environment variables ####

The kit uses the following environment variables for secrets and global configuration:

- `CRAFT_AI_TOKEN` the [craft ai] token with write access to a project. The kit will use this project to host its agents.
- `DEBUG` (*optional*) a prefix to toggle the debug output for different parts of the kit. Set it to `craft-ai:*` to display the logging information related to [craft ai]. For details, refer to [the `debug` package](https://github.com/visionmedia/debug).

> ℹ To manage the environment variables of your project, you can use the [`dotenv` project](https://github.com/motdotla/dotenv).

## Attribution ##

[![Powered By Dark Sky](./poweredby_dark_sky.png)](https://darksky.net/poweredby/)


[craft ai]: http://www.craft.ai
