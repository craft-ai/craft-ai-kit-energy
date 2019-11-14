function anomalies(object) {
  return object
    && typeof object === 'object'
    && typeof object.recordsCount === 'number'
    && object.recordsCount >= 0
    && Array.isArray(object.values)
    && object.values.every(anomaly)
    && object.values.length <= object.recordsCount;
}

function anomaly(value) {
  return prediction(value) && typeof value.actualLoad === 'number';
}

function prediction(value) {
  return value
    && typeof value === 'object'
    && value.context
    && typeof value.context === 'object'
    && value.date instanceof Date
    && typeof value.predictedLoad === 'number'
    && typeof value.confidence === 'number'
    && value.confidence > 0 && value.confidence < 1
    && typeof value.standardDeviation === 'number'
    && Array.isArray(value.decisionRules);
}

function predictions(values) {
  return Array.isArray(values) && values.every(prediction);
}

function report(object) {
  return anomalies(object)
    && object.average
    && typeof object.average === 'object'
    && typeof object.average.actualLoad === 'number'
    && typeof object.average.predictedLoad === 'number'
    && typeof object.average.predictedStandardDeviation === 'number'
    && (isNaN(object.average.predictedStandardDeviation) || object.average.predictedStandardDeviation >= 0)
    && typeof object.average.absoluteDifference === 'number'
    && (isNaN(object.average.absoluteDifference) || object.average.absoluteDifference >= 0);
}

module.exports = {
  anomalies,
  anomaly,
  prediction,
  predictions,
  report
};
