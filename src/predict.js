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
        return Promise.reject(new Error(`Argument \`cfg.from\` must belong to (${fromTimestamp}, ${toTimestamp}], the range of timestamp for which we have data for user \`${user.id}\`.`));
      }

      if (toTimestamp <= fromTimestamp || toTimestamp > user.lastTimestamp) {
        return Promise.reject(new Error(`Argument \`cfg.to\` must after the given \`cfg.from\` (${from}) and belong to (${from}, ${toTimestamp}], the range of timestamp for which we have data for user \`${user.id}\`.`));
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
            from: sample.timestamp,
            to: sample.timestamp + tree.configuration.time_quantum,
            actual: sample.sample[outputProperty],
            expected: decision.output[outputProperty].predicted_value,
            standardDeviation: decision.output[outputProperty].standard_deviation,
            confidence: decision.output[outputProperty].confidence,
            decisionRules: decision.output[outputProperty].decision_rules
          };
        })
        .map(({ from, to, actual, expected, standardDeviation, confidence, decisionRules }) => {
          const loadDeviation = Math.min(standardDeviation * cfg.sigmaDeviationThreshold, cfg.absoluteDeviationThreshold);
          const predictedRange = [Math.max(expected - loadDeviation, 0), expected + loadDeviation];
          const valid = predictedRange[0] <= actual && actual <= predictedRange[1];
          if (confidence < cfg.confidenceThreshold) {
            return {
              from, to, actual, decisionRules,
              status: PREDICTION_STATUS.UNKNOWN
            };
          }
          else if (valid) {
            return {
              from, to, actual, predictedRange, decisionRules,
              status: PREDICTION_STATUS.VALID
            };
          }
          else if (actual > predictedRange[1]) {
            return {
              from, to, actual, predictedRange, decisionRules,
              status: PREDICTION_STATUS.OVERESTIMATED
            };
          }
          else {
            return {
              from, to, actual, predictedRange, decisionRules,
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
