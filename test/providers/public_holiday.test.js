const luxon = require('luxon');
const test = require('ava');

const Common = require('../../src/endpoint/common');
const Constants = require('../../src/constants');
const Provider = require('../../src/provider');
const PublicHolidayProvider = require('../../src/providers/public_holiday');


test.beforeEach((t) => Provider
  .initialize({
    provider: PublicHolidayProvider,
    options: { ...PROVIDER_OPTIONS }
  }, 0)
  .then((provider) => t.context.provider = provider));


test('fails initializing the provider with invalid options', (t) => {
  const INVALID_OPTIONS = [null, undefined, 1228, false, Promise.resolve(), Symbol(), '', 'Jupiter'];

  return Promise.all(INVALID_OPTIONS
    .concat(INVALID_OPTIONS.map((option) => ({ country: option })))
    .map((options) => t.throws(PublicHolidayProvider.initialize({ options }))));
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
        t.is(extension.holiday === 'YES', isHoliday(record, HOLIDAYS));
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
        t.is(extension.holiday === 'YES', isHoliday(record, HOLIDAYS));
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
        t.is(extension.holiday === 'YES', isHoliday(record, REUNION_HOLIDAYS));
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
        t.is(extension.holiday === 'YES', isHoliday(record, MOSELLE_HOLIDAYS));
      }))
    .awaitPromises()
    .drain();
});

test('closes the provider', (t) => {
  return t.notThrows(t.context.provider.close());
});


function isHoliday(record, holidays) {
  const date = record[PARSED_RECORD][DATE];

  return holidays.some((dateParts) => date.year === dateParts[0]
    && date.month === dateParts[1]
    && date.day === dateParts[2]);
}


const PARSED_RECORD = Constants.PARSED_RECORD;
const DATE = Constants.DATE_FEATURE;
const HOLIDAYS = [
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
  [2018, 3, 30],
  [2018, 12, 26],
  [2019, 4, 19],
  [2019, 12, 26],
].concat(HOLIDAYS);
const REUNION_HOLIDAYS = [
  [2018, 12, 20],
  [2019, 12, 20],
].concat(HOLIDAYS);
const PROVIDER_OPTIONS = { country: 'fr' };
const DateTime = luxon.DateTime;

const WINDOW_START = DateTime.utc(...HOLIDAYS[0]).startOf('year');
const WINDOW_END = DateTime.utc(...HOLIDAYS[HOLIDAYS.length - 1]).plus({ year: 1 }).startOf('year');
const WINDOW = new Array(WINDOW_END.diff(WINDOW_START).as('days'))
  .fill(null)
  .map((_, index) => ({ date: WINDOW_START.plus({ days: index }) }));
