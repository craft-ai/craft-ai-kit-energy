const debug = require('debug');
const most = require('most');

const Constants = require('../constants');
const Utils = require('../utils');

/**
 * @param {{ from: Date, to: Date }} states
 * @param {{ period: { [duration: string]: number } }} options
 */
async function computeRollingEvaluation(states, options) {
  this.debug('computing evaluation');

  const log = debug(`${DEBUG_PREFIX}:endpoint:${this.id}:info`);

  let from, to;

  if (states !== undefined) {
    if (states === null || typeof states != 'object') {
      throw TypeError(`The "states" argument must be an "object". Received "${typeof states}".`);
    }

    if (states.from !== undefined) {
      from = Utils.parseDate(states.from);

      if (!from.isValid) {
        throw RangeError(`The "from" property of the "states" argument must be a valid date. Received: ${states.from}`);
      }
    }

    if (states.to !== undefined) {
      to = Utils.parseDate(states.to);

      if (!to.isValid) {
        throw RangeError(`The "to" property of the "states" argument must be a valid date. Received: ${states.to}`);
      }
    }
  }

  if (from === undefined) {
    if (this.agent.firstTimestamp === undefined) {
      throw Error('This agent was not updated. The "from" property of the "states" argument must be defined when the agent was not updated.');
    }

    from = Utils.parseDate(this.agent.firstTimestamp * 1000);
  }

  if (to === undefined) {
    if (this.agent.lastTimestamp === undefined) {
      throw Error('This agent was not updated. The "to" property of the "states" argument must be defined when the agent was not updated.');
    }

    to = Utils.parseDate(this.agent.lastTimestamp * 1000);
  }

  if (options === null || options === undefined) {
    options = ROLL_PREDICTIONS_DEFAULT;
  }
  else {
    if (typeof options !== 'object') {
      throw TypeError(`The "options" argument must be an "object". Received "${typeof options}".`);
    }
    if (options.period === undefined) {
      options.period = ROLL_PREDICTIONS_DEFAULT.period;
    }
  }

  const period = Utils.parseDuration(options.period);

  if (typeof period !== 'object' || !period.isValid) {
    throw TypeError('The "period" option is invalid. Expected an ISO Duration String, a Javascript Object or a number of milliseconds');
  }
  if (Number(period) === 0) {
    throw TypeError('The "period" option must refer to a non null duration.');
  }

  let chunksCount = 0;
  let currentChunk = 0;

  return most.unfold((date) =>  {
    chunksCount += 1;

    if (date === null) {
      return { done: true };
    }

    const nextDate = date.plus(period);

    return nextDate >= to
      ? { value: { from: date, to }, seed: null }
      : { value: { from: date, to: nextDate.minus(1) }, seed: nextDate };
  }, from)
    .concatMap((dates) => most.fromPromise(this
      .retrieveRecords(dates.from, dates.to, true)
      .then((records) => this.computeReport(records, {
        minConfidence: 0,
        minAbsoluteDifference: 0,
        minSigmaDifference: 0
      }, records.slice(0, 1)[0][DATE]))
      .then((report) => {
        currentChunk += 1;

        this.debug(`${Math.trunc(currentChunk / chunksCount * 100)}% of rolling  done`);

        const predictions = report.values;
        const length = report.recordsCount;
        const modelTimestamp =  predictions[0][DATE].valueOf();
        const lastRecord = predictions[length - 1];

        const averageConfidence = predictions.reduce(sumConfidences, 0) / length;
        report.average.averageConfidence = averageConfidence;

        const lastDate = Utils
          .setZone(Utils.parseDate(lastRecord[DATE]), `utc${lastRecord.context[TIMEZONE]}`)
          .toFormat('dd LLLL yyyy HH:mm:ss ZZ');
        log(`Predictions computed up to ${lastDate}, Average confidence: ${averageConfidence.toFixed(2)}`);
        return { ...report, modelTimestamp };
      })))
    .reduce((results, report) => results.concat(report), []);
}

function sumConfidences(sum, value) {
  return value.confidence + sum;
}

const DATE = Constants.DATE_FEATURE;
const TIMEZONE = Constants.TIMEZONE_FEATURE;
const DEBUG_PREFIX = Constants.DEBUG_PREFIX;
const ROLL_PREDICTIONS_DEFAULT = { period: { days: 7 } };

module.exports = {
  computeRollingEvaluation
};

