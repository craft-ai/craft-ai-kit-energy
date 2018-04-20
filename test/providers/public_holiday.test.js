const luxon = require('luxon');
const test = require('ava');

const Provider = require('../../src/provider');
const PublicHolidayProvider = require('../../src/providers/public_holiday');


test('fails initializing the provider with invalid options', (t) => {
  const INVALID_OPTIONS = [null, undefined, 1228, false, Promise.resolve(), Symbol(), '', 'Jupiter'];

  return Promise.all(INVALID_OPTIONS
    .concat(INVALID_OPTIONS.map((option) => ({ country: option })))
    .map((option) => t.throws(PublicHolidayProvider.initialize({ options: option }))));
});

test('initializes the provider', (t) => {
  return initializeProvider().then((provider) => t.snapshot(provider));
});

test('computes the configuration\'s extension', (t) => {
  return initializeProvider().then((provider) => provider
    .computeConfigurationExtension()
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.snapshot(extension);
    }));
});

test('computes the record\'s extension', (t) => {
  return Promise.all(WINDOW.map((date) => initializeProvider().then((provider) => provider
    .computeRecordExtension({ metadata: {} }, date)
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.is(extension.holiday === 'YES', isHoliday(date, HOLIDAYS));
    }))));
});

test('computes the record\'s extension in Paris', (t) => {
  return Promise.all(WINDOW.map((date) => initializeProvider().then((provider) => provider
    .computeRecordExtension({ metadata: { region: '75' } }, date)
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.is(extension.holiday === 'YES', isHoliday(date, HOLIDAYS));
    }))));
});

test('computes the record\'s extension in Réunion', (t) => {
  return Promise.all(WINDOW.map((date) => initializeProvider().then((provider) => provider
    .computeRecordExtension({ metadata: { region: '974' } }, date)
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.is(extension.holiday === 'YES', isHoliday(date, REUNION_HOLIDAYS));
    }))));
});

test('computes the record\'s extension in Alsace-Moselle', (t) => {
  return Promise.all(WINDOW.map((date) => initializeProvider().then((provider) => provider
    .computeRecordExtension({ metadata: { region: '88' } }, date)
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.is(extension.holiday === 'YES', isHoliday(date, ALSACE_MOSELLE_HOLIDAYS));
    }))));
});

test('closes the provider', (t) => {
  return initializeProvider().then((provider) => t.notThrows(provider.close()));
});


function initializeProvider() {
  return Provider.initialize({
    provider: PublicHolidayProvider,
    options: Object.assign({}, PROVIDER_OPTIONS)
  }, 0);
}

function isHoliday(date, holidays) {
  return holidays.some((dateParts) => date.year === dateParts[0]
    && date.month === dateParts[1]
    && date.day === dateParts[2]);
}


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
const ALSACE_MOSELLE_HOLIDAYS = [
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
const WINDOW = new Array(365 * WINDOW_END.diff(WINDOW_START).as('year'))
  .fill(null)
  .map((_, index) => WINDOW_START.plus({ days: index }));
