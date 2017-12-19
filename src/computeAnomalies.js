const _ = require('lodash');
const { predict, PREDICTION_STATUS } = require('./predict');

const debug = require('debug')('craft-ai:kit-energy');

function computeAnomalies({ cfg, clients }, user = {}, { from, to } = {}) {
  if (_.isUndefined(from) || _.isUndefined(to)) {
    return Promise.reject(new Error('`cfg.from` and `cfg.to` are needed.'));
  }

  return predict({ cfg, clients }, user, { from, to })
    .then(({ user, predictions }) => {
      const anomalies = _.filter(predictions, ({ status }) => status == PREDICTION_STATUS.OVERESTIMATED || status == PREDICTION_STATUS.UNDERESTIMATED);
      const anomalyRatio = anomalies.length / predictions.length;
      debug(`Identified ${anomalies.length} anomalies for user ${user.id}, or ${Math.round(anomalyRatio * 100)}% of considered data`);

      return { anomalies, anomalyRatio, user };
    });
}

module.exports = { computeAnomalies };
