async function computeAnomalies(records, options, model) {}

async function computePredictions(states, model) {}

async function computeReport(records, options, model) {}


module.exports = {
  anomalies: computeAnomalies,
  predictions: computePredictions,
  report: computeReport,
};
