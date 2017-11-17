# Changelog #

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.3...HEAD) ##

### Changed ###

- `kit.update` now uses streams internally and supports any `Iterable` or `Observable` for its data argument.
- `kit.update` now automatically skips the data points that are anterior to data previously sent.
- `kit.update` now automatically skips initial incomplete data points, i.e. it only start sending data to craft ai once a first complete state is reached.
- `user` data structures (returned by `kit.update`) now also includes the data `firstTimestamp` in addition of the `lastTimestamp`.

### Added ###

- Introducing `sigmaFactorThreshold` and `confidenceThreshold` to the kit
configuration. `sigmaFactorThreshold` is the difference threshold, in amount of
standard deviations, for a data point to be considered an anomaly, its default
value is `2`. `confidenceThreshold` is the confidence threshold over which a
prediction is considered to be accurate, its default value is `O.4`.

## [0.0.3](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.2...v0.0.3) - 2017-11-06 ##

### Changed ###

- Migrating the **craft ai** client from [v1.11.0 to v1.13.0](https://github.com/craft-ai/craft-ai-client-js/blob/master/CHANGELOG.md#1130---2017-10-30)

## [0.0.2](https://github.com/craft-ai/craft-ai-kit-energy/compare/v0.0.1...v0.0.2) - 2017-10-17 ##

### Added ###

- Ability to provide data for the weather instead of retrieving it from DarkSky.

  When no `DARK_SKY_SECRET_KEY` is provided, weather data are expected to be provided in the data points as `tempMin` and `tempMax`, respectively the minimal and maximum temperature of the day.

- The kit now relies on [craft ai JavaScript client v1.11.1](https://www.npmjs.com/package/craft-ai)
  especially on `client.getAgentStateHistory`.

### Changed ###

- Data points type is now:
  ```js
  {
    date: /* ISO 8061 date, as a string, or unix timestamp, as a number */
    load: /* electrical load in kW ,as a number */
  }
  ```

## 0.0.1 - 2017-10-09 ##

- Initial version of the _energy_ kit.
