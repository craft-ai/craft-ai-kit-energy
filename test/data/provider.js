const seedrandom = require('seedrandom');


async function initialize(provider) {
  if (!provider.options.random) provider.options.random = seedrandom('weather');
}

async function computeConfigurationExtension() {
  return {
    [TEMPERATURE_MAX]: { type: 'continuous' },
    [TEMPERATURE_MIN]: { type: 'continuous' },
  };
}

async function computeRecordExtension(endpoint) {
  const averageMax = endpoint.metadata && endpoint.metadata.averageMax || 10;
  const averageMin = endpoint.metadata && endpoint.metadata.averageMin || 3;

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
const FEATURES = [TEMPERATURE_MAX, TEMPERATURE_MIN];

module.exports = {
  close,
  computeConfigurationExtension,
  computeRecordExtension,
  initialize,
  FEATURES,
};
