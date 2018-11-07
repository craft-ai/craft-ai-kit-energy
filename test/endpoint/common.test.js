const buffer = require('most-buffer');
const nth = require('most-nth');
const test = require('ava');

const Constants = require('../../src/constants');
const Helpers = require('../helpers');
const Common = require('../../src/endpoint/common');


test('properly formats timezone', async(t) => {
  const date = '2017-07-30T02:30:00';

  // with timezone as a feature 
  const timezones_feature = await IANA_ZONES
    .map((zone) => Common.toRecordStream([{ date, [TIMEZONE] : zone }], {}, false))
    .reduce((records, record) => records.concat(record))
    .thru(buffer())
    .thru(nth.last);

  // with timezone as an option 
  return IANA_ZONES
    .map((zone) => Common.toRecordStream([{ date }], {}, false, zone))
    .reduce((records, record) => records.concat(record))
    .map((record) => ({ formatted: record[TIMEZONE], raw: record[PARSED_RECORD][DATE].zone }))
    .thru(buffer())
    .thru(nth.last)
    .then((timezones) => {
      timezones.map((timezone, idx) => t.is(timezone.formatted, timezones_feature[idx][TIMEZONE]));
      t.snapshot(timezones);
    });
});

const DATE = Constants.DATE_FEATURE;
const PARSED_RECORD = Constants.PARSED_RECORD;
const TIMEZONE = Constants.TIMEZONE_FEATURE;
const IANA_ZONES = Helpers.IANA_ZONES;
