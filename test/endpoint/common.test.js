const buffer = require('most-buffer');
const nth = require('most-nth');
const test = require('ava');

const Constants = require('../../src/constants');
const Helpers = require('../helpers');
const Common = require('../../src/endpoint/common');


test('properly formats timezone', async(t) => {
  const date = '2017-07-30T02:30:00';

  return Promise.all([
    IANA_ZONES.map((zone) => Common.toRecordStream([{ date, [TIMEZONE] : zone }], {}, false)), // with timezone as a feature
    IANA_ZONES.map((zone) => Common.toRecordStream([{ date }], {}, false, zone))  // with timezone as an option
  ].map((records) => records.reduce((records, record) => records.concat(record)))
    .map((records) => records.thru(buffer()))
    .map((records) => records.thru(nth.last)))
    .then((records) => {
      records[0].forEach((record, idx) => t.is(record[TIMEZONE], records[1][idx][TIMEZONE]));
      t.snapshot(records[0].map((record) => ({ formatted: record[TIMEZONE], raw: record[PARSED_RECORD][DATE].zone })));
    });
});

const DATE = Constants.DATE_FEATURE;
const PARSED_RECORD = Constants.PARSED_RECORD;
const TIMEZONE = Constants.TIMEZONE_FEATURE;
const IANA_ZONES = Helpers.IANA_ZONES;
