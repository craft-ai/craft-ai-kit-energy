# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.3.0...HEAD)

### Fixed

- Parsing numeric embedded properties when provided as a string.

## [0.3.0](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.2.2...v0.3.0) - 2018-11-20

### Fixed

- Unable to parse dates with negative time offsets.
- Unable to compute predictions on states outside the local timezone.
- Unbale to compute predictions from retrieved records without manually setting the timezone

### Added

- Retrieving the timezone of a record directly from its `timezone` feature.
- Introducing a `zone` option on the kit and endpoint's objects.

## [0.2.2](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.2.1...v0.2.2) - 2018-10-08

### Fixed

- Caching issue with the `WeatherProvider` while extending records on a hourly basis with offseted times.
- Shifted Easter based holidays when given a non-UTC date to the `PublicHolidayProvier`.

## [0.2.1](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.2.0...v0.2.1) - 2018-09-28

### Fixed

- Unable to use the French `SchoolHolidaysProvider`.

## [0.2.0](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.1.0...v0.2.0) - 2018-09-27

### BREAKING CHANGES

The signature of the method `endpoint.computePredictions()` has been changed to include an `options` argument.

### Added

- Introducing a CSV import helper with streaming capabilities and custom parsing options.
- Supporting a path to a CSV file as the first argument of some methods of an endpoint's instance.
- Introducing a `WeatherProvider` [powered by _Dark Sky API_](https://darksky.net/poweredby/).
- Exposing an option to control the refresh rate of the providers.
- Checking the optional field `metadata` of the endpoints.
- Supporting additional embedded context properties.
- Handle records with consumption as energy and accumulated energy.
- Exposing options to load and save the internal cache of the `WeatherProvider`.
- Introducing an **examples** directory containing, for now, one simple example showcasing the kit using [UCI's Individual Household Electric Power Consumption Data Set](https://archive.ics.uci.edu/ml/datasets/individual+household+electric+power+consumption).

### Changed

- Clearing caches when closing a provider.
- Passing the whole record to the provider for the generation of record extensions.
- Rename the features used by the public and school holiday providers to be able to use both.

### Fixed

- Unable to compute predictions with states (not containing `load` property).
- Unable to compute predictions while using providers.
- Exception raised by the `WeatherProvider` when issuing bad request to _Dark Sky API_.

## [0.1.0](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.7...v0.1.0) - 2018-07-04

### BREAKING CHANGES

In the aim of publishing the first version of the energy kit, we rewrote its API from the ground up:
- introducing the notion of _endpoint_, which interfaces with a craft ai agent by uploading the consumption history of an electrical endpoint and exposing a few methods to make the most of the underlying predictive models.
- introducing the concept of _providers_ to bring new context information, like weather condition, to the process of generating the predictive models.

## [0.0.7](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.6...v0.0.7) - 2017-12-19

### Added

- Introducing `kit.validate`, a method running a validation of the craft ai agents of a given user over their lifetime, it outputs its validation metrics over time.
- Introducing `kit.predict`, a method able to run a bunch of predictions for a given user.
- Introducing `cfg.absoluteDeviationThreshold`, the maximum deviation to the predicted load for a prediction to be considered 'valid', expressed in Watts, disabled by default.

### Changed

- Renaming `cfg.sigmaFactorThreshold` to `cfg.sigmaDeviationThreshold`.

## [0.0.6](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.5...v0.0.6) - 2017-11-24

### Changed

- You can now specify a `user.agentId` instead of letting the kit generate it.

## [0.0.5](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.4...v0.0.5) - 2017-11-21

### Changed

- When holidays retrieval fails, the craft ai properties is now set to `UNKNOWN` instead of raising an error.

### Fixed

- _Tarn-et-Garonne_ holidays are now properly retrieved; the retrieval now works on every french departement.
- Postal Code starting with a 0 (e.g. Menton's `06500`) are now properly handled.

## [0.0.4](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.3...v0.0.4) - 2017-11-17

### Changed

- `kit.update` now uses streams internally and supports any `Iterable` or `Observable` for its data argument.
- `kit.update` now automatically skips the data points that are anterior to data previously sent.
- `kit.update` now automatically skips initial incomplete data points, i.e. it only start sending data to craft ai once a first complete state is reached.
- `user` data structures (returned by `kit.update`) now also includes the data `firstTimestamp` in addition of the `lastTimestamp`.

### Added

- Introducing `sigmaFactorThreshold` and `confidenceThreshold` to the kit configuration. `sigmaFactorThreshold` is the difference threshold, in amount of standard deviations, for a data point to be considered an anomaly, its default value is `2`. `confidenceThreshold` is the confidence threshold over which a prediction is considered to be accurate, its default value is `O.4`.

## [0.0.3](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.2...v0.0.3) - 2017-11-06

### Changed

- Migrating the **craft ai** client from [v1.11.0 to v1.13.0](https://github.com/craft-ai/craft-ai-client-js/blob/master/CHANGELOG.md#1130---2017-10-30)

## [0.0.2](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.1...v0.0.2) - 2017-10-17

### Added

- Ability to provide data for the weather instead of retrieving it from DarkSky.

> When no `DARK_SKY_SECRET_KEY` is provided, weather data are expected to be provided in the data points as `tempMin` and `tempMax`, respectively the minimal and maximum temperature of the day.

- The kit now relies on [craft ai JavaScript client v1.11.1](https://www.npmjs.com/package/craft-ai)
  especially on `client.getAgentStateHistory`.

### Changed

- Data points type is now:
  ```js
  {
    date: /* ISO 8061 date, as a string, or unix timestamp, as a number */
    load: /* electrical load in kW ,as a number */
  }
  ```

## 0.0.1 - 2017-10-09

- Initial version of the _energy_ kit.
