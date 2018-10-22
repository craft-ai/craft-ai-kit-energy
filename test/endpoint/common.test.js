const buffer = require('most-buffer');
const luxon = require('luxon');
const nth = require('most-nth');
const test = require('ava');

const Constants = require('../../src/constants');
const Helpers = require('../helpers');
const Common = require('../../src/endpoint/common');


test('properly formats timezone', (t) => {
  const date = '2017-07-30T02:30:00';
  const states = IANA_ZONES
    .map((zone) => DateTime.fromISO(date).setZone(zone, { keepLocalTime: true }))
    .sort((a, b) => a - b)
    .map((date) => ({ date }));

  return Common
    .toRecordStream(states)
    .map((record) => ({ formatted: record.timezone, raw: record[PARSED_RECORD][DATE].zone }))
    .thru(buffer())
    .thru(nth.last)
    .then((timezones) => t.snapshot(timezones));
});


const DATE = Constants.DATE_FEATURE;
const PARSED_RECORD = Constants.PARSED_RECORD;
const IANA_ZONES = Helpers.IANA_ZONES;
const DateTime = luxon.DateTime;
