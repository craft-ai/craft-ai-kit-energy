const luxon = require('luxon');
const test = require('ava');

const Common = require('../../src/endpoint/common');
const Constants = require('../../src/constants');
const Helpers = require('../helpers');
const Provider = require('../../src/provider');
const PublicHolidayProvider = require('../../src/providers/public_holiday');


test.beforeEach((t) => Helpers.createProviderContext(t, PublicHolidayProvider, { country: 'fr' }));
test.afterEach.always(Helpers.destroyProviderContext);


test('fails initializing the provider with invalid options', (t) => {
  return Promise.all(INVALID_OBJECTS
    .concat(INVALID_OBJECTS.map((option) => ({ country: option })))
    .map((options) => t.throwsAsync(Provider.initialize({ provider: PublicHolidayProvider, options }, 0))));
});

test('initializes the provider', (t) => {
  return t.snapshot(t.context.provider);
});

test('computes the configuration\'s extension', (t) => {
  return t.context.provider
    .extendConfiguration()
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.snapshot(extension);
    });
});

test('computes the record\'s extension', (t) => {
  return Common
    .toRecordStream(WINDOW)
    .map((record) => t.context.provider
      .extendRecord({ metadata: {} }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension[HOLIDAY] === 'YES', isHoliday(record, HOLIDAYS));
      }))
    .awaitPromises()
    .drain();
});

test('computes the record\'s extension in Paris', (t) => {
  return Common
    .toRecordStream(WINDOW)
    .map((record) => t.context.provider
      .extendRecord({ metadata: { region: '75' } }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension[HOLIDAY] === 'YES', isHoliday(record, HOLIDAYS));
      }))
    .awaitPromises()
    .drain();
});

test('computes the record\'s extension in Réunion', (t) => {
  return Common
    .toRecordStream(WINDOW)
    .map((record) => t.context.provider
      .extendRecord({ metadata: { region: '974' } }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension[HOLIDAY] === 'YES', isHoliday(record, REUNION_HOLIDAYS));
      }))
    .awaitPromises()
    .drain();
});

test('computes the record\'s extension in Moselle', (t) => {
  return Common
    .toRecordStream(WINDOW)
    .map((record) => t.context.provider
      .extendRecord({ metadata: { region: '57' } }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension[HOLIDAY] === 'YES', isHoliday(record, MOSELLE_HOLIDAYS));
      }))
    .awaitPromises()
    .drain();
});

test('closes the provider', (t) => {
  return t.notThrowsAsync(t.context.provider.close());
});


function isHoliday(record, holidays) {
  const date = record[PARSED_RECORD][DATE];

  return holidays.some((dateParts) => date.year === dateParts[0]
    && date.month === dateParts[1]
    && date.day === dateParts[2]);
}


const PARSED_RECORD = Constants.PARSED_RECORD;
const DATE = Constants.DATE_FEATURE;
const LOAD = Constants.LOAD_FEATURE;
const HOLIDAY = PublicHolidayProvider.HOLIDAY;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const HOLIDAYS = [
  [2017, 1, 1],
  [2017, 4, 16], [2017, 4, 17],
  [2017, 5, 1], [2017, 5, 8], [2017, 5, 25],
  [2017, 6, 4], [2017, 6, 5],
  [2017, 7, 14],
  [2017, 8, 15],
  [2017, 11, 1], [2017, 11, 11],
  [2017, 12, 25],
  [2018, 1, 1],
  [2018, 4, 1], [2018, 4, 2],
  [2018, 5, 1], [2018, 5, 8], [2018, 5, 10], [2018, 5, 20], [2018, 5, 21],
  [2018, 7, 14],
  [2018, 8, 15],
  [2018, 11, 1], [2018, 11, 11],
  [2018, 12, 25],
  [2019, 1, 1],
  [2019, 4, 21], [2019, 4, 22],
  [2019, 5, 1], [2019, 5, 8], [2019, 5, 30],
  [2019, 6, 9], [2019, 6, 10],
  [2019, 7, 14],
  [2019, 8, 15],
  [2019, 11, 1], [2019, 11, 11],
  [2019, 12, 25],
];
const MOSELLE_HOLIDAYS = [
  [2017, 4, 14],
  [2017, 12, 26],
  [2018, 3, 30],
  [2018, 12, 26],
  [2019, 4, 19],
  [2019, 12, 26],
].concat(HOLIDAYS);
const REUNION_HOLIDAYS = [
  [2017, 12, 20],
  [2018, 12, 20],
  [2019, 12, 20],
].concat(HOLIDAYS);
const WINDOW_START = luxon.DateTime.local(...HOLIDAYS[0]).startOf('year');
const WINDOW_END = luxon.DateTime.local(...HOLIDAYS[HOLIDAYS.length - 1]).plus({ years: 1 }).startOf('year');
const WINDOW = new Array(WINDOW_END.diff(WINDOW_START).as('days'))
  .fill(null)
  .map((_, days) => ({ [DATE]: WINDOW_START.plus({ days }), [LOAD]: 0 }));
