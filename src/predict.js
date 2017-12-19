const _ = require('lodash');
const { retrieveAgent } = require('./agent');
const { interpreter, Time } = require('craft-ai');

const PREDICTION_STATUS = {
  UNKNOWN: 'UNKNOWN',
  VALID: 'VALID',
  OVERESTIMATED: 'OVERESTIMATED',
  UNDERESTIMATED: 'UNDERESTIMATED'
};

function predict({ cfg, clients }, user = {}, { from, to } = {}) {
  if (_.isUndefined(from)) {
    return Promise.reject(new Error('Missing required argument `cfg.from`.'));
  }

  return retrieveAgent({ clients }, user)
    .then((user) => {
      const fromTimestamp = Time(from).timestamp;
      const toTimestamp = to ? Time(to).timestamp : user.lastTimestamp;

      if (fromTimestamp <= user.firstTimestamp || fromTimestamp > user.lastTimestamp) {
        return Promise.reject(new Error(`Argument \`cfg.from\` must belong to (${user.firstTimestamp}, ${user.lastTimestamp}], the range of timestamp for which we have data for user \`${user.id}\`.`));
      }

      if (toTimestamp <= fromTimestamp) {
        return Promise.reject(new Error(`Argument \`cfg.to\` must after the given \`cfg.from\` (${from}).`));
      }

      return Promise.all([
        clients.craftai.getAgentDecisionTree(user.agentId, from),
        clients.craftai.getAgentStateHistory(user.agentId, from, to)
      ]);
    })
    .then(([tree, samples]) => {
      const outputProperty = tree.configuration.output[0];
      const predictions = samples
        .map((sample) => {
          const decision = interpreter.decide(tree, sample.sample);
          return {
            timestamp: sample.timestamp,
            actual: sample.sample[outputProperty],
            predicted: decision.output[outputProperty].predicted_value,
            predictedStandardDeviation: decision.output[outputProperty].standard_deviation,
            confidence: decision.output[outputProperty].confidence,
            decisionRules: decision.output[outputProperty].decision_rules
          };
        })
        .map(({ timestamp, actual, predicted, predictedStandardDeviation, confidence, decisionRules }) => {
          const loadDeviation = Math.min(predictedStandardDeviation * cfg.sigmaDeviationThreshold, cfg.absoluteDeviationThreshold);
          const predictedRange = [Math.max(predicted - loadDeviation, 0), predicted + loadDeviation];
          const valid = predictedRange[0] <= actual && actual <= predictedRange[1];
          if (confidence < cfg.confidenceThreshold) {
            return {
              timestamp, actual, decisionRules,
              status: PREDICTION_STATUS.UNKNOWN
            };
          }
          else if (valid) {
            return {
              timestamp, actual, predicted, predictedRange, predictedStandardDeviation, decisionRules,
              status: PREDICTION_STATUS.VALID
            };
          }
          else if (actual > predictedRange[1]) {
            return {
              timestamp, actual, predicted, predictedRange, predictedStandardDeviation, decisionRules,
              status: PREDICTION_STATUS.OVERESTIMATED
            };
          }
          else {
            return {
              timestamp, actual, predicted, predictedRange, predictedStandardDeviation, decisionRules,
              status: PREDICTION_STATUS.UNDERESTIMATED
            };
          }
        });

      return {
        user,
        predictions
      };
    });
}

module.exports = { PREDICTION_STATUS, predict };
