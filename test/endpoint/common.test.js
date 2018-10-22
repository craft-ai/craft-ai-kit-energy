const test = require('ava');
const luxon = require('luxon');
const Helpers = require('../helpers');
const Utils = require('../../src/utils');
const Constants = require('../../src/constants');
const Common = require('../../src/endpoint/common');


test('properly formats timezone', (t) => {
  const date = "2017-07-30T02:30:00"
  const dates = NONLOCAL_TIMEZONES.map(zone => DateTime.fromISO(date, {zone:zone}))
  const states = dates.map(el=> ({date: el.toISO(), load : Math.random()*100}));
  const intOffsets = dates.map(el => el.offset).map(offset => Math.trunc(offset/60))
  let records = states.map(record => Common.toRecord(record, {}))
  return records.forEach((record, idx) => t.is(parseInt(record.timezone), intOffsets[idx]))
});

const RECORDS = Helpers.RECORDS;
const NONLOCAL_TIMEZONES = Helpers.NONLOCAL_TIMEZONES;
const DATE = Constants.DATE_FEATURE;
const PARSED_RECORD = Constants.PARSED_RECORD;
const DateTime = luxon.DateTime;
