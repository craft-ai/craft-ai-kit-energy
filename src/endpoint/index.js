const compute = require('./compute');
const update = require('./update');
const retrieve = require('./retrieve');
const destroy = require('./destroy');


module.exports = {
  destroy, update,
  computeAnomalies: compute.anomalies,
  computePredictions: compute.predictions,
  computeReport: compute.report,
  retrievePredictiveModel: retrieve.predictiveModel,
  retrieveRecords: retrieve.records,
};
