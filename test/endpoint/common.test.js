const buffer = require('most-buffer');
const nth = require('most-nth');
const test = require('ava');

const Constants = require('../../src/constants');
const Helpers = require('../helpers');
const Common = require('../../src/endpoint/common');


test('properly formats timezone', (t) => {
  const date = '2017-07-30T02:30:00';
  return IANA_ZONES
    .map((zone) => Common.toRecordStream([{ date }], {}, false, zone))
    .reduce((records, record) => records.concat(record))
    .map((record) => ({ formatted: record.timezone, raw: record[PARSED_RECORD][DATE].zone }))
    .thru(buffer())
    .thru(nth.last)
    .then((timezones) => t.snapshot(timezones));
});

const DATE = Constants.DATE_FEATURE;
const PARSED_RECORD = Constants.PARSED_RECORD;
const IANA_ZONES = Helpers.IANA_ZONES;
