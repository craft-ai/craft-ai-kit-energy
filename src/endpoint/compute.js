const craftai = require('craft-ai');

const Common = require('./common');
const Constants = require('../constants');
const Utils = require('../utils');


async function computeAnomalies(records, options, model) {
  this.debug('computing anomalies');

  if (options === null || options === undefined) options = {};
  else if (typeof options !== 'object')
    throw TypeError(`The "options" argument must be an "object". Received "${typeof options}".`);
  if (options.minConfidence !== undefined && typeof options.minConfidence !== 'number')
    throw TypeError(`The "minConfidence" option must be a "number". Received "${typeof options.minConfidence}".`);
  if (options.minAbsoluteDifference !== undefined && typeof options.minAbsoluteDifference !== 'number')
    throw TypeError(`The "minAbsoluteDifference" option must be a "number". Received "${typeof options.minAbsoluteDifference}".`);
  if (options.minSigmaDifference !== undefined && typeof options.minSigmaDifference !== 'number')
    throw TypeError(`The "minSigmaDifference" option must be a "number". Received "${typeof options.minSigmaDifference}".`);

  const minConfidence = options.minConfidence === undefined ? .4 : options.minConfidence;
  const minAbsoluteDifference = options.minAbsoluteDifference === undefined ? 0 : options.minAbsoluteDifference;
  const minSigmaDifference = options.minSigmaDifference === undefined ? 2 : options.minSigmaDifference;

  return retrieveRecords(this, records, true).then((records) => this
    .computePredictions(records, model === undefined && records.length ? records[0][DATE] : model)
    .then((predictions) => {
      predictions.forEach((prediction, index) => prediction.actualLoad = prediction[ORIGINAL_RECORD][LOAD]);

      const values = predictions.filter((prediction) => {
        if (prediction.confidence < minConfidence) return false;

        const absoluteDifference = Math.abs(prediction.predictedLoad - prediction.actualLoad);

        return absoluteDifference >= minAbsoluteDifference
          && absoluteDifference >= minSigmaDifference * prediction.standardDeviation;
      });

      this.debug('found %d anomalies among %d records', values.length, records.length);

      return { values, recordsCount: records.length };
    }));
}

async function computePredictions(states, model) {
  this.debug('computing predictions');

  const features = this.features.filter((feature) => feature !== LOAD);

  return retrieveModel(this, model)
    .then((model) => Common
      .toRecordStream(states)
      .thru(Common.mergeUntilFirstFullRecord.bind(null, features))
      .thru(Common.formatRecords.bind(null, features))
      .loop((previous, state) => {
        const context = state.context;
        const current = Object.assign(previous, context);
        const result = interpreter.decide(model, current, new craftai.Time(state[TIMESTAMP]));
        const output = result.output[LOAD];

        return {
          seed: current,
          value: Object.defineProperty({
            date: context[PARSED_DATE].toJSDate(),
            context: result.context,
            predictedLoad: output.predicted_value,
            confidence: output.confidence,
            standardDeviation: output.standard_deviation,
            decisionRules: output.decision_rules
          }, ORIGINAL_RECORD, { value: context[ORIGINAL_RECORD] })
        };
      }, {})
      .thru(Utils.toBuffer))
    .then((predictions) => {
      this.debug('computed %d predictions', predictions.length);

      return predictions;
    });
}

async function computeReport(records, options, model) {
  this.debug('computing a report');

  if (options !== null && typeof options === 'object') {
    if (options.minConfidence === undefined) options.minConfidence = .4;
    if (options.minAbsoluteDifference === undefined) options.minAbsoluteDifference = 0;
    if (options.minSigmaDifference === undefined) options.minSigmaDifference = 0;
  }

  return this
    .computeAnomalies(records, options, model)
    .then((result) => {
      const values = result.values;

      this.debug('computed the report');

      return {
        values,
        recordsCount: result.recordsCount,
        average: computeAverages(values)
      };
    });
}


async function retrieveModel(endpoint, value) {
  if (Utils.isPredictiveModel(value)) return value;

  return endpoint.retrievePredictiveModel(value);
}

async function retrieveRecords(endpoint, value) {
  if (Array.isArray(value)) return value;

  return Utils
    .toStream(value)
    .thru(Utils.toBuffer)
    .catch(() => {
      if (value !== null && typeof value === 'object') return endpoint.retrieveRecords(value.from, value.to);

      throw new TypeError('The records must be provided as a stream, an iterable or a window object.');
    });
}

function computeAverages(values) {
  const length = values.length;

  if (!length)
    return { actualLoad: NaN, predictedLoad: NaN, predictedStandardDeviation: NaN, absoluteDifference: NaN };

  const counts = values.reduce((counts, value) => {
    const actualLoad = value.actualLoad;
    const predictedLoad = value.predictedLoad;

    counts.actualLoad += actualLoad;
    counts.predictedLoad += predictedLoad;
    counts.predictedStandardDeviation += value.standardDeviation;
    counts.absoluteDifference += Math.abs(predictedLoad - actualLoad);

    return counts;
  }, { actualLoad: 0, predictedLoad: 0, predictedStandardDeviation: 0, absoluteDifference: 0 });

  for (const key in counts) counts[key] /= length;

  return counts;
}


const DATE = Constants.DATE_FEATURE;
const LOAD = Constants.LOAD_FEATURE;
const ORIGINAL_RECORD = Constants.ORIGINAL_RECORD;
const PARSED_DATE = Constants.PARSED_DATE;
const TIMESTAMP = Constants.TIMESTAMP_FEATURE;

const interpreter = craftai.interpreter;


module.exports = {
  anomalies: computeAnomalies,
  predictions: computePredictions,
  report: computeReport,
};
