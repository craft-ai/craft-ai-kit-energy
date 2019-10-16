const luxon = require('luxon');
const seedrandom = require('seedrandom');

async function initialize(provider) {
  if (!provider.options.random) provider.options.random = seedrandom('weather');

  provider.refresh.origin = luxon.DateTime.fromISO('12:00:00');
  provider.refresh.period = 24 * 3600;
}

async function extendConfiguration() {
  return {
    [TEMPERATURE_MAX]: { type: 'continuous' },
    [TEMPERATURE_MIN]: { type: 'continuous' }
  };
}

async function extendConfigurationOption() {
  return {
    [DEACTIVATE_MISSING_VALUES_OPTION]: false
  };
}

async function extendRecord(endpoint) {
  const averageMax = (endpoint.metadata && endpoint.metadata.averageMax) || 10;
  const averageMin = (endpoint.metadata && endpoint.metadata.averageMin) || 3;

  return {
    [TEMPERATURE_MAX]: averageMax + 8 * this.options.random(),
    [TEMPERATURE_MIN]: averageMin + 6 * this.options.random(),
  };
}

async function close() {
  /* Does nothing. */
}

const TEMPERATURE_MAX = 'temperatureMax';
const TEMPERATURE_MIN = 'temperatureMin';
const DEACTIVATE_MISSING_VALUES_OPTION = 'deactivate_missing_values';
const FEATURES = [TEMPERATURE_MAX, TEMPERATURE_MIN];
const OPTIONS = [DEACTIVATE_MISSING_VALUES_OPTION];

module.exports = {
  close,
  extendConfiguration,
  extendConfigurationOption,
  extendRecord,
  initialize,
  FEATURES,
  OPTIONS,
};
