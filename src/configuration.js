const _ = require('lodash');

const DEFAULT_CONFIGURATION = {
  token: process.env.CRAFT_TOKEN,
  weatherCache: undefined,
  darkSkySecretKey: undefined,
  confidenceThreshold: 0.4,
  relativeDeviationThreshold: 2,
  absoluteDeviationThreshold: Number.MAX_VALUE
};

const CHECK_CONFIGURATION = {
  absoluteDeviationThreshold: (value) => {
    if (value == undefined) {
      return true;
    }
    if (!_.isNumber(value)) {
      throw new Error(`'${value}' is not a valid absolute deviation threshold, it should be a number.`);
    }
    if (value <= 0) {
      throw new Error(`'${value}' is not a valid absolute deviation threshold, it should be a positive number.`);
    }
    return true;
  },
  relativeDeviationThreshold: (value) => {
    if (!_.isNumber(value)) {
      throw new Error(`'${value}' is not a valid relative deviation threshold, it should be a number.`);
    }
    if (value <= 0) {
      throw new Error(`'${value}' is not a valid relative deviation threshold, it should be a positive number.`);
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
