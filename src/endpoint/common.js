const most = require('most');

const Constants = require('../constants');
const Stream = require('../stream');
const Utils = require('../utils');


function formatRecords(endpoint, records) {
  const context = endpoint.agent.configuration.context;
  const features = endpoint.features;
  const continuousFeatures = features.filter((key) => context[key].type === 'continuous');

  return records
    // Remove unknown keys
    .tap((record) => {
      for (const key in record)
        if (key !== DATE && !features.includes(key)) delete record[key];
    })
    // Remove unchanged features
    .loop((previous, record) => {
      features.forEach((key) => {
        const value = record[key];

        if (value && value === previous[key]) delete record[key];
      });

      return { seed: Object.assign(previous, record), value: record };
    }, {})
    .tap((record) => continuousFeatures.forEach((key) => {
      if (typeof record[key] === 'string') {
        record[key] = Utils.parseNumber(record[key]);
      }
    }))
    .map(toContextOperation);
}

function mergeUntilFirstFullRecord(features, records) {
  return records
    .loop((seed, record) => {
      if (!seed.checked.length) return { seed, value: record };

      const merged = seed.record ? Object.assign(seed.record, record) : record;

      seed.checked = seed.checked.filter((feature) => !(feature in merged));
      seed.record = merged;

      return { seed, value: seed.checked.length ? null : merged };
    }, { record: null, checked: features })
    .skipWhile(Utils.isNull);
}

function toRecordStream(values, options, onlyRecords, zone) {
  return Stream
    .from(values, options)
    .map((value) => toRecord(value, zone))
    .filter(onlyRecords ? isValidRecord : isValidState)
    .thru(checkRecordsAreSorted);
}


function checkRecordsAreSorted(records) {
  return records
    .concat(most.of(null))
    .loop((previous, record) => {
      if (!record) return { value: previous };
      if (!previous) return { value: null, seed: record };

      if (previous[DATE] > record[DATE])
        throw new Error('The records must be sorted by ascending date.');

      // Merge records on the same date
      return previous[DATE] === record[DATE]
        ? { value: null, seed: Object.assign(previous, record) }
        : { value: previous, seed: record };
    }, null)
    .filter(Utils.isNotNull);
}

function isValidRecord(record) {
  return isValidState(record)
    && (record[LOAD] !== undefined || record[ENERGY] !== undefined);
}

function isValidState(state) {
  return !isNaN(state[DATE]);
}

function toContextOperation(record) {
  const timestamp = record[DATE];
  const context = record;

  delete record[DATE];

  return { timestamp, context };
}

function toRecord(value, zone) {
  if (value === null || typeof value !== 'object')
    throw new TypeError(`A record must be an "object". Received "${value === null ? 'null' : typeof value}".`);

  const date = Utils.setZone(Utils.parseDate(value[DATE]), value[TIMEZONE] || zone);
  const record = { ...value };

  if (date.isValid) {
    const parsed = {};
    const timezone = Utils.formatTimezone(date.offset);

    record[DATE] = Math.floor(date.valueOf() / 1000);
    record[TIMEZONE] = timezone;
    record[LOAD] = Utils.parseNumber(record[LOAD]);
    record[ENERGY] = Utils.parseNumber(record[ENERGY]);

    parsed[DATE] = date;
    parsed[TIMEZONE] = timezone;
    parsed[LOAD] = record[LOAD];
    parsed[ENERGY] = record[ENERGY];

    Object.defineProperty(record, ORIGINAL_RECORD, { value });
    Object.defineProperty(record, PARSED_RECORD, { value: parsed });
  } else record[DATE] = NaN;

  return record;
}


const DATE = Constants.DATE_FEATURE;
const LOAD = Constants.LOAD_FEATURE;
const ENERGY = Constants.ENERGY_FEATURE;
const ORIGINAL_RECORD = Constants.ORIGINAL_RECORD;
const PARSED_RECORD = Constants.PARSED_RECORD;
const TIMEZONE = Constants.TIMEZONE_FEATURE;


module.exports = {
  formatRecords,
  isValidRecord,
  mergeUntilFirstFullRecord,
  toRecordStream,
};
