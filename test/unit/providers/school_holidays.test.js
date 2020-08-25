const luxon = require('luxon');
const test = require('ava');

const Common = require('../../../src/endpoint/common');
const Constants = require('../../../src/constants');
const Helpers = require('../../helpers');
const Provider = require('../../../src/provider');
const SchoolHolidaysProvider = require('../../../src/providers/school_holidays');

function isHoliday(record, holidays) {
  const date = record[PARSED_RECORD][DATE];

  return holidays.some((holidays) => date > DateTime.local(...holidays[0])
    .endOf('day')
    && date < DateTime.local(...holidays[1])
      .startOf('day'));
}

const PARSED_RECORD = Constants.PARSED_RECORD;
const DATE = Constants.DATE_FEATURE;
const LOAD = Constants.LOAD_FEATURE;
const HOLIDAY = SchoolHolidaysProvider.HOLIDAY;
const INVALID_OBJECTS = Helpers.INVALID_OBJECTS;
const PARIS_HOLIDAYS = [
  [[2017, 7, 31], [2017, 9, 4]],
  [[2017, 10, 21], [2017, 11, 6]],
  [[2017, 12, 23], [2018, 1, 8]],
  [[2018, 2, 17], [2018, 3, 5]],
  [[2018, 4, 14], [2018, 4, 30]],
  [[2018, 7, 7], [2018, 7, 31]]
];
const CAEN_HOLIDAYS = [
  [[2017, 7, 31], [2017, 9, 4]],
  [[2017, 10, 21], [2017, 11, 6]],
  [[2017, 12, 23], [2018, 1, 8]],
  [[2018, 2, 24], [2018, 3, 12]],
  [[2018, 4, 25], [2018, 5, 14]],
  [[2018, 7, 7], [2018, 7, 31]]
];
const LILLE_HOLIDAYS = [
  [[2017, 7, 31], [2017, 9, 4]],
  [[2017, 10, 21], [2017, 11, 6]],
  [[2017, 12, 23], [2018, 1, 8]],
  [[2018, 2, 24], [2018, 3, 12]],
  [[2018, 4, 21], [2018, 5, 7]],
  [[2018, 7, 7], [2018, 7, 31]]
];
const DateTime = luxon.DateTime;

const WINDOW_START = DateTime.local(...PARIS_HOLIDAYS[0][0])
  .plus({ days: 1 });
const WINDOW_END = DateTime.local(...PARIS_HOLIDAYS[PARIS_HOLIDAYS.length - 1][1]);
const WINDOW = new Array(WINDOW_END.diff(WINDOW_START)
  .as('days'))
  .fill(null)
  .map((_, days) => ({ [DATE]: WINDOW_START.plus({ days }), [LOAD]: 0 }));

test.beforeEach((t) => Helpers.createProviderContext(t, SchoolHolidaysProvider, { country: 'fr' }));
test.afterEach.always(Helpers.destroyProviderContext);

test('fails initializing the provider with invalid options', (t) => {
  return Promise.all(INVALID_OBJECTS
    .concat(INVALID_OBJECTS.map((option) => ({ country: option })))
    .map((options) => t.throwsAsync(Provider.initialize({ provider: SchoolHolidaysProvider, options }, 0))));
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

test('computes the record\'s extension in Paris', (t) => {
  return Common
    .toRecordStream(WINDOW)
    .map((record) => t.context.provider
      .extendRecord({ metadata: { region: '75' } }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension[HOLIDAY] === 'YES', isHoliday(record, PARIS_HOLIDAYS));
      }))
    .awaitPromises()
    .drain();
});

test('computes the record\'s extension in Lille', (t) => {
  return Common
    .toRecordStream(WINDOW)
    .map((record) => t.context.provider
      .extendRecord({ metadata: { region: '59' } }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension[HOLIDAY] === 'YES', isHoliday(record, LILLE_HOLIDAYS));
      }))
    .awaitPromises()
    .drain();
});

test('computes the record\'s extension in Caen', (t) => {
  return Common
    .toRecordStream(WINDOW)
    .map((record) => t.context.provider
      .extendRecord({ metadata: { region: '14' } }, record)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension[HOLIDAY] === 'YES', isHoliday(record, CAEN_HOLIDAYS));
      }))
    .awaitPromises()
    .drain();
});

test('handles computing the record\'s extension for an unknown region', (t) => {
  return Common
    .toRecordStream(WINDOW)
    .map((record) => t.context.provider.extendRecord({ metadata: { region: '00' } }, record))
    .awaitPromises()
    .observe((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.is(extension[HOLIDAY], 'UNKNOWN');
    });
});

test('handles computing the record\'s extension with no school holidays information', (t) => {
  return Common
    .toRecordStream(WINDOW)
    .map((record) => ({ [PARSED_RECORD]: { [DATE]: record[PARSED_RECORD][DATE].minus({ year: 200 }) } }))
    .map((record) => t.context.provider.extendRecord({ metadata: { region: '75' } }, record))
    .awaitPromises()
    .observe((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.is(extension[HOLIDAY], 'UNKNOWN');
    });
});

test('closes the provider', (t) => {
  return t.notThrowsAsync(t.context.provider.close());
});
