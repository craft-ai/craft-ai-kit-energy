const most = require('most');

const Utils = require('../utils');
const Constants = require('../constants');


function formatRecords(features, records) {
  return records
    // Remove unknown keys
    .tap((record) => Object.keys(record).forEach((key) => {
      if (key !== DATE && !features.includes(key)) delete record[key];
    }))
    // Remove unchanged features
    .loop((previous, record) => {
      features.forEach((key) => {
        const value = record[key];

        if (value && value === previous[key]) delete record[key];
      });

      return { seed: Object.assign(previous, record), value: record };
    }, {})
    // Format records to context operations
    .map((record) => {
      const timestamp = record[DATE];
      const context = record;

      delete record[DATE];

      return { timestamp, context };
    });
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

function toRecordStream(value) {
  return Utils
    .toStream(value)
    .map((value) => {
      const date = Utils.parseDate(value[DATE]);
      const record = Object.assign({}, value);

      Object.defineProperty(record, ORIGINAL_RECORD, { value });
      Object.defineProperty(record, PARSED_DATE, { value: date });

      if (date) {
        record[DATE] = Math.floor(date.valueOf() / 1000);
        record[TIMEZONE] = Utils.formatTimezone(date.offset);
      } else record[DATE] = NaN;

      return record;
    })
    .filter((record) => !isNaN(record[DATE]))
    .thru(checkRecordsAreSorted);
}


function checkRecordsAreSorted(records) {
  return records
    .concat(most.of(undefined))
    .loop((previous, record) => {
      if (!previous) return { seed: record };
      if (!record) return { value: previous };

      // TODO: proper error handling
      if (previous[DATE] > record[DATE]) throw new Error();

      // Merge records on the same date
      return previous[DATE] === record[DATE]
        ? { seed: Object.assign(previous, record) }
        : { seed: record, value: previous };
    })
    .filter((record) => record !== undefined);
}


const DATE = Constants.DATE_FEATURE;
const ORIGINAL_RECORD = Constants.ORIGINAL_RECORD;
const PARSED_DATE = Constants.PARSED_DATE;
const TIMEZONE = Constants.TIMEZONE_FEATURE;


module.exports = {
  formatRecords,
  mergeUntilFirstFullRecord,
  toRecordStream,
};
