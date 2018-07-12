const most = require('most');

const Constants = require('../constants');
const Stream = require('../stream');
const Utils = require('../utils');


function formatRecords(features, records) {
  return records
    .filter(recordHasValue)
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

function toRecordStream(values, options) {
  return Stream
    .from(values, options)
    .map(toRecord)
    .filter(recordHasValidDate)
    .thru(checkRecordsAreSorted);
}


function checkRecordsAreSorted(records) {
  return records
    .concat(most.of(undefined))
    .loop((previous, record) => {
      if (!previous) return { seed: record };
      if (!record) return { value: previous };

      if (previous[DATE] > record[DATE])
        throw new Error('The records must be sorted by ascending date.');

      // Merge records on the same date
      return previous[DATE] === record[DATE]
        ? { seed: Object.assign(previous, record) }
        : { seed: record, value: previous };
    })
    .filter(Utils.isNotUndefined);
}

function recordHasValidDate(record) { return !isNaN(record[DATE]); }

function recordHasValue(record) {
  // TODO: Accept index values
  return typeof record[LOAD] === 'number';
}

function toContextOperation(record) {
  const timestamp = record[DATE];
  const context = record;

  delete record[DATE];

  return { timestamp, context };
}

function toRecord(value) {
  if (value === null || typeof value !== 'object')
    throw new TypeError(`A record must be an "object". Received "${value === null ? 'null' : typeof value}".`);

  const date = Utils.parseDate(value[DATE]);
  const record = { ...value };

  if (date) {
    const parsed = {};
    const timezone = Utils.formatTimezone(date.offset);

    parsed[DATE] = date;
    record[DATE] = Math.floor(date.valueOf() / 1000);
    parsed[TIMEZONE] = timezone;
    record[TIMEZONE] = timezone;

    if (typeof record[LOAD] === 'string') record[LOAD] = Number(record[LOAD].replace(',', '.'));
    // TODO: Parse index values

    parsed[LOAD] = record[LOAD];

    Object.defineProperty(record, ORIGINAL_RECORD, { value });
    Object.defineProperty(record, PARSED_RECORD, { value: parsed });
  } else record[DATE] = NaN;

  return record;
}


const DATE = Constants.DATE_FEATURE;
const LOAD = Constants.LOAD_FEATURE;
const ORIGINAL_RECORD = Constants.ORIGINAL_RECORD;
const PARSED_RECORD = Constants.PARSED_RECORD;
const TIMEZONE = Constants.TIMEZONE_FEATURE;


module.exports = {
  formatRecords,
  mergeUntilFirstFullRecord,
  toRecordStream,
};
