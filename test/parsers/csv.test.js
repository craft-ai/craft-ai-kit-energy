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
      [[FILEPATH, { columns: ['missing_the_required_columns'] }], RangeError],
      [[FILEPATH, { columns: ['date', 'missing_load_or_index'] }], RangeError],
      [[FILEPATH, { columns: ['load', 'missing_date'] }], RangeError],
      [[FILEPATH, { columns: ['index', 'missing_date'] }], RangeError],
      [[path.join(DATA_DIRECTORY, './wrong_data.csv')], Error],
    ].map((parameters) => t.throws(CsvHelper.stream(...parameters[0]).drain(), parameters[1])))
    .then((errors) => t.snapshot(errors));
});

test('streams a CSV file', (t) => {
  return CsvHelper
    .stream(FILEPATH, { delimiter: ';', columns: ['date', 'load'] })
    .thru(buffer())
    .thru(nth.first)
    .then((records) => t.deepEqual(records, Helpers.RECORDS));
});

test('streams a portion of a CSV file', (t) => {
  return CsvHelper
    .stream(FILEPATH, {
      from: WINDOW_START + 1,
      to: WINDOW_END,
      delimiter: ';',
      columns: ['date', 'load']
    })
    .thru(buffer())
    .thru(nth.first)
    .then((records) => t.deepEqual(records, RECORDS.slice(WINDOW_START, WINDOW_END)));
});

test('streams a CSV file written in a custom format', (t) => {
  return CsvHelper
    .stream(path.join(DATA_DIRECTORY, './custom_format.csv'), {
      quote: '.',
      escape: '\\'
    })
    .thru(buffer())
    .thru(nth.first)
    .then((records) => t.snapshot(records));
});


const DATA_DIRECTORY = path.join(__dirname, '../helpers/data');
const FILEPATH = path.join(DATA_DIRECTORY, './records.csv');
const RECORDS = Helpers.RECORDS;
// Skipping the 4 last records with no load information
const WINDOW_END = RECORDS.length - 5;
const WINDOW_START = Math.floor(WINDOW_END * .7);
