const _ = require('lodash');
const { retrieveAgent } = require('./agent');
const { predict, PREDICTION_STATUS } = require('./predict');
const range = require('most-range');
const most = require('most');
const buffer = require('most-buffer');
const { last } = require('most-nth');

const debug = require('debug')('craft-ai:kit-energy');

function validate({ cfg, clients }, user = {}, { window = 3600 * 24 * 7, windowsCount = Number.MAX_SAFE_INTEGER } = {}) {
  return retrieveAgent({ clients }, user)
    .then((user) => {
      const { id, firstTimestamp, lastTimestamp } = user;
      const maximumWindowsCount = Math.floor((lastTimestamp - firstTimestamp) / window);
      windowsCount = Math.min(windowsCount, maximumWindowsCount);
      debug(`Validating user ${id} over the last ${windowsCount} windows of ${window} seconds.`);

      return range(lastTimestamp - windowsCount * window, lastTimestamp, window)
        .concatMap((from) => {
          const to = from + window;
          return most.fromPromise(predict({ cfg, clients }, user, { from, to })
            .then(({ user, predictions }) => {
              const count = predictions.length;
              const actualPredictions = _.filter(predictions, ({ status }) => status !== PREDICTION_STATUS.UNKNOWN);
              const unknownCount = count - actualPredictions.length;
              const meanPredictedRange = _.reduce(actualPredictions, (meanPredictedRange, { predictedRange }) => meanPredictedRange + (predictedRange[1] - predictedRange[0]) / 2 / (count - unknownCount), 0);
              const overestimatedCount = _.filter(predictions, ({ status }) => status == PREDICTION_STATUS.OVERESTIMATED).length;
              const underestimatedCount = _.filter(predictions, ({ status }) => status == PREDICTION_STATUS.UNDERESTIMATED).length;
              const validCount = _.filter(predictions, ({ status }) => status == PREDICTION_STATUS.VALID).length;
              return {
                from,
                to,
                count,
                valid: validCount / count,
                overestimated: overestimatedCount / count,
                underestimated: underestimatedCount / count,
                unknown: unknownCount / count,
                meanPredictedRange
              };
            }));
        })
        .thru(buffer())
        .thru(last)
        .then((validations) => ({
          user,
          validations
        }));
    });
}

module.exports = { validate };
