const csv = require('csv-parse');
const fs = require('fs');
const most = require('most');

const Utils = require('../utils');


function stream(filepath, options = {}) {
  const error = validateArguments(filepath, options);

  if (error) return most.throwError(error);

  const file = fs.createReadStream(filepath);

  const rows = file.pipe(csv({
    from: options.from,
    to: options.to,
    delimiter: options.delimiter || ',',
    quote: options.quote || '"',
    escape: options.escape || '"',
    columns: options.columns || true,
    skip_empty_lines: true,
    trim: true,
  }));

  // Forward error from the read stream to the piped stream
  file.once('error', (error) => {
    // [Readable.destroy()](https://nodejs.org/dist/latest-v10.x/docs/api/stream.html#stream_readable_destroy_error) doesn't exist on Node.js 6.x LTS
    rows.emit('error', error);
    rows.end();
  });

  return most
    .fromEvent('error', rows)
    .chain((error) => {
      /* istanbul ignore else */
      if (error.code === 'ENOENT') throw new Error(`The "filepath" argument of the CSV helper refers to an unexisting file: "${filepath}".`);
      /* istanbul ignore next */
      if (error.code === 'EACCES') throw new Error(`The "filepath" argument of the CSV helper refers to a protected file: "${filepath}".`);

      /* istanbul ignore next */
      throw error;
    })
    .merge(most.fromEvent('data', rows).filter(hasValue).tap(parse))
    .until(most.fromEvent('end', rows));
}


function validateArguments(filepath, options) {
  if (typeof filepath !== 'string')
    return new TypeError(`The "filepath" argument of the CSV helper must be a "string". Received "${typeof filepath}".`);

  const from = options.from;

  if (from !== undefined) {
    if (typeof from !== 'number')
      return new TypeError(`The "from" option of the CSV helper must be a "number". Received "${typeof from}".`);
    if (from < 0)
      return new RangeError(`The "from" option of the CSV helper must be a positive integer. Received "${from}".`);
  }

  const to = options.to;

  if (to !== undefined) {
    if (typeof to !== 'number')
      return new TypeError(`The "to" option of the CSV helper must be a "number". Received "${typeof to}".`);
    if (to < (from || 0))
      return new RangeError(`The "to" option of the CSV helper must be a positive integer and greater or equal to the "from" option. Received "${to}".`);
  }

  const delimiter = options.delimiter;

  if (delimiter !== undefined) {
    if (typeof delimiter !== 'string')
      return new TypeError(`The "delimiter" option of the CSV helper must be a "string". Received "${typeof delimiter}".`);
    if (delimiter.length !== 1)
      return new RangeError(`The "delimiter" option of the CSV helper must be a single character. Received "${delimiter}".`);
  }

  const quote = options.quote;

  if (quote !== undefined) {
    if (typeof quote !== 'string')
      return new TypeError(`The "quote" option of the CSV helper must be a "string". Received "${typeof quote}".`);
    if (quote.length !== 1)
      return new RangeError(`The "quote" option of the CSV helper must be a single character. Received "${quote}".`);
  }

  const escape = options.escape;

  if (escape !== undefined) {
    if (typeof escape !== 'string')
      return new TypeError(`The "escape" option of the CSV helper must be a "string". Received "${typeof escape}".`);
    if (escape.length !== 1)
      return new RangeError(`The "escape" option of the CSV helper must be a single character. Received "${escape}".`);
  }

  const columns = options.columns;

  if (columns !== undefined) {
    if (!Array.isArray(columns))
      return new TypeError(`The "columns" option of the CSV helper must be an "array". Received "${typeof columns}".`);
    if (columns.some(Utils.notString))
      return new TypeError(`The "columns" option of the CSV helper must only contain "string" value. Received ${JSON.stringify(JSON.stringify(columns))}.`);
    if (!(columns.includes('date') && (columns.includes('load') || columns.includes('index'))))
      return new RangeError(`The "columns" option of the CSV helper must at least contain the value "date" and either "load" or "index". Received ${JSON.stringify(JSON.stringify(columns))}.`);
  }
}

function hasValue(record) {
  return record.load || record.index;
}

function parse(record) {
  if (!record.date)
    throw new Error(`Imported records from the CSV helper must contain a non-empty value "date". Received "${record.date}".`);

  if (record.load) record.load = Number(record.load.replace(',', '.'));
  if (record.index) record.index = Number(record.index.replace(',', '.'));
}


module.exports = {
  stream,
};
