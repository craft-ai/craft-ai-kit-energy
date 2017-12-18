const _ = require('lodash');
const { AGENT_CONFIGURATION, retrieveAgent } = require('./agent');
const { interpreter } = require('craft-ai');

const debug = require('debug')('craft-ai:kit-energy');

function computeAnomalies({ cfg, clients }, user = {}, { from, minStep = AGENT_CONFIGURATION.time_quantum, to } = {}) {
  return retrieveAgent({ clients }, user)
    .then((user) => {
      const { agentId, id } = user;
      debug(`Computing anomalies for user ${id}`);
      if (_.isUndefined(from) || _.isUndefined(to)) {
        return Promise.reject(new Error('`cfg.from` and `cfg.to` are needed.'));
      }

      debug(`Getting consumption decision tree for user ${id}`);

      return Promise.all([
        user,
        clients.craftai.getAgentDecisionTree(agentId, from),
        clients.craftai.getAgentStateHistory(agentId, from, to)
      ]);
    })
    .then(([user, tree, samples]) => {
      debug(`Looking for anomalies for ${samples.length} steps between ${from} and ${to} for user ${user.id}`);
      const potentialAnomalies = _.map(samples, (sample) => {
        const decision = interpreter.decide(tree, sample.sample);
        return {
          from: sample.timestamp,
          to: sample.timestamp + minStep - 1,
          actualLoad: sample.sample.load,
          expectedLoad: decision.output.load.predicted_value,
          standard_deviation: decision.output.load.standard_deviation,
          confidence: decision.output.load.confidence,
          decision_rules: decision.output.load.decision_rules
        };
      });
      const detectedAnomalies = _.filter(potentialAnomalies, (a) =>
        (a.confidence > cfg.confidenceThreshold) &&
        (Math.abs(a.actualLoad - a.expectedLoad) > cfg.sigmaFactorThreshold * a.standard_deviation));
      debug(`Identified ${detectedAnomalies.length} anomalies for user ${user.id}, or ${Math.round((detectedAnomalies.length / potentialAnomalies.length) * 100)}% of considered data`);
      return { anomalies: detectedAnomalies, anomalyRatio: (detectedAnomalies.length / potentialAnomalies.length) };
    });
}

module.exports = { computeAnomalies };
