const _ = require('lodash');

const DEFAULT_CONFIGURATION = {
  token: process.env.CRAFT_TOKEN,
  weatherCache: undefined,
  darkSkySecretKey: undefined,
  sigmaFactorThreshold: 2,
  confidenceThreshold: 0.4
};

const CHECK_CONFIGURATION = {
  sigmaFactorThreshold: (value) => {
    if (!_.isNumber(value)) {
      throw new Error(`'${value}' is not a valid Sigma factor threshold, it should be a number.`);
    }
    if (value <= 0) {
      throw new Error(`'${value}' is not a valid Sigma factor threshold, it should be a positive number.`);
    }
    return true;
  },
  confidenceThreshold: (value) => {
    if (!_.isNumber(value)) {
      throw new Error(`'${value}' is not a valid confidence threshold, it should be a number.`);
    }
    if (value < 0 || value >= 1.0) {
      throw new Error(`'${value}' is not a valid confidence threshold, it should belong to [0,1).`);
    }
    return true;
  }
};

const NO_CHECK = (value) => true;

function checkConfiguration(cfg) {
  return _.every(cfg, (value, key) => (CHECK_CONFIGURATION[key] || NO_CHECK)(value));
}

module.exports = { DEFAULT_CONFIGURATION, checkConfiguration };
