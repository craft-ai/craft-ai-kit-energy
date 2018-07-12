const buffer = require('most-buffer');
const nth = require('most-nth');
const path = require('path');
const test = require('ava');

const CsvHelper = require('../../src/parsers/csv');
const Helpers = require('../helpers');


test('fails streaming a CSV file with invalid parameters', (t) => {
  return Promise
    .all([
      [[null], TypeError],
      [['unexisting_file'], Error],
      [[FILEPATH, { from: 'not_a_number' }], TypeError],
      [[FILEPATH, { from: -1 }], RangeError],
      [[FILEPATH, { to: 'not_a_number' }], TypeError],
      [[FILEPATH, { to: -1 }], RangeError],
      [[FILEPATH, { from: 10, to: 1 }], RangeError],
      [[FILEPATH, { delimiter: false }], TypeError],
      [[FILEPATH, { delimiter: 'string' }], RangeError],
      [[FILEPATH, { quote: Infinity }], TypeError],
      [[FILEPATH, { quote: 'string' }], RangeError],
      [[FILEPATH, { escape: {} }], TypeError],
      [[FILEPATH, { escape: 'string' }], RangeError],
      [[FILEPATH, { columns: 'not_an_array' }], TypeError],
      [[FILEPATH, { columns: ['not_only_strings', []] }], TypeError],
      [[FILEPATH, { columns: ['not_matching_column_number'] }], Error],
    ].map((parameters) => t.throws(CsvHelper.stream(...parameters[0]).drain(), parameters[1])))
    .then((errors) => t.snapshot(errors));
});

test('streams a CSV file', (t) => {
  return CsvHelper
    .stream(FILEPATH)
    .thru(buffer())
    .thru(nth.first)
    .then((records) => t.deepEqual(parseRecords(records), Helpers.RECORDS));
});

test('streams a portion of a CSV file', (t) => {
  return CsvHelper
    .stream(FILEPATH, { from: WINDOW_START, to: WINDOW_END })
    .thru(buffer())
    .thru(nth.first)
    .then((records) => t.deepEqual(parseRecords(records), RECORDS.slice(WINDOW_START, WINDOW_END)));
});

test('streams a CSV file written in a custom format', (t) => {
  return CsvHelper
    .stream(path.join(DATA_DIRECTORY, './custom_format.csv'), {
      delimiter: ';',
      quote: '.',
      escape: '\\',
      columns: ['date', 'index'],
    })
    .thru(buffer())
    .thru(nth.first)
    .then((records) => t.snapshot(records));
});


function parseRecords(records) {
  return records.filter((record) => record.load).map((record) => {
    record.load = Number(record.load.replace(',', '.'));

    return record;
  });
}


const DATA_DIRECTORY = path.join(__dirname, '../helpers/data');
const FILEPATH = path.join(DATA_DIRECTORY, './records.csv');
const RECORDS = Helpers.RECORDS;
// Skipping the 4 last records with no load information
const WINDOW_END = RECORDS.length - 5;
const WINDOW_START = Math.floor(WINDOW_END * .7);
