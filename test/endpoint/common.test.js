const buffer = require('most-buffer');
const most = require('most');
const test = require('ava');

const Constants = require('../../src/constants');
const Helpers = require('../helpers');
const Common = require('../../src/endpoint/common');


test('properly formats timezone', async(t) => {
  const date = '2017-07-30T02:30:00';

  return most
    .from([
      // with timezone as a feature
      IANA_ZONES.map((zone) => Common.toRecordStream([{ date, [TIMEZONE]: zone }], {}, false)),
      // with timezone as an option
      IANA_ZONES.map((zone) => Common.toRecordStream([{ date }], {}, false, zone)),
    ])
    .chain((streams) => most.mergeArray(streams).thru(buffer()))
    .thru(buffer())
    .observe((result) => {
      const records = result[0];

      t.deepEqual(records, result[1]);
      t.snapshot(records.map((record) => ({
        formatted: record[TIMEZONE],
        raw: record[PARSED_RECORD][DATE].zone.name
      })));
    });
});

const DATE = Constants.DATE_FEATURE;
const PARSED_RECORD = Constants.PARSED_RECORD;
const TIMEZONE = Constants.TIMEZONE_FEATURE;
const IANA_ZONES = Helpers.IANA_ZONES;
