const compute = require('./compute');
const evaluate = require('./evaluate');
const update = require('./update');
const retrieve = require('./retrieve');
const destroy = require('./destroy');

module.exports = {
  destroy, update,
  evaluate: evaluate.computeRollingEvaluation,
  computeAnomalies: compute.anomalies,
  computePredictions: compute.predictions,
  computeReport: compute.report,
  retrievePredictiveModel: retrieve.predictiveModel,
  retrieveRecords: retrieve.records
};
