# Changelog #

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased (https://github.com/craft-ai/craft-ai-client-js/compare/v0.0.1...HEAD) ##

### Added ###

- Ability to provide data for the weather instead of retrieving it from DarkSky.

  When no `DARK_SKY_SECRET_KEY` is provided, weather data are expected to be provided in the data points as `tempMin` and `tempMax`, respectively the minimal and maximum temperature of the day.

- The kit now relies on [craft ai JavaScript client v1.11.1](https://www.npmjs.com/package/craft-ai
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
