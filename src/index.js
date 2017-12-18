const { retrieveAgent } = require('./agent');
const { checkConfiguration, DEFAULT_CONFIGURATION } = require('./configuration');
const { computeAnomalies } = require('./computeAnomalies');
const { createClient } = require('craft-ai');
const { update } = require('./update');
const { predict, PREDICTION_STATUS } = require('./predict');
const { validate } = require('./validate');
const createGeolocationClient = require('./geolocation');
const createHolidays = require('./holidays');
const createWeatherClient = require('./weather');

const debug = require('debug')('craft-ai:kit-energy');

function createKit(cfg = {}) {
  cfg = Object.assign({}, DEFAULT_CONFIGURATION, cfg);

  checkConfiguration(cfg);

  const { darkSkySecretKey, token, weatherCache } = cfg;
  const clients = {
    craftai: createClient(token),
    weather: darkSkySecretKey && createWeatherClient({
      cache: weatherCache,
      darkSkySecretKey: darkSkySecretKey
    }),
    geolocation: createGeolocationClient(),
    holidays: createHolidays()
  };

  cfg.weatherCache = clients.weather && clients.weather.cache;
  cfg.darkSkySecretKey = clients.weather && clients.weather.darkSkySecretKey;

  return {
    PREDICTION_STATUS,
    cfg: cfg,
    clients,
    terminate: () => {
      // Nothing to do for now
      return Promise.resolve();
    },
    getLastDataTimestamp: (user) => {
      return retrieveAgent({ clients }, user)
        .then(({ lastTimestamp }) => lastTimestamp);
    },
    delete: (user) => {
      debug(`Deleting user ${user.id} if it exists`);
      return retrieveAgent({ clients }, user)
        .then(
          ({ agentId }) => clients.craftai.deleteAgent(agentId).then(() => user),
          // Ignoring `retrieveAgent` errors, if we can't retrieve it, it means it no longer exists.
          () => user
        );
    },
    update: (user, data) =>
      update({ clients }, user, data),
    predict: (user, predictCfg) =>
      predict({ cfg, clients }, user, predictCfg),
    computeAnomalies: (user, computeAnomaliesCfg) =>
      computeAnomalies({ cfg, clients }, user, computeAnomaliesCfg),
    validate: (user, validateCfg) =>
      validate({ cfg, clients }, user, validateCfg),
  };
}

module.exports = createKit;
