const csv = require('csv-parse');
const fs = require('fs');
const most = require('most');
const path = require('path');

const Stream = require('../stream');
const Utils = require('../utils');

function stream(filepath, options = {}) {
  const error = validateArguments(filepath, options);

  if (error) {
    return most.throwError(error);
  }

  const file = fs.createReadStream(filepath);

  const rows = file.pipe(csv({
    from: options.from ? options.from + 1 : 0,
    to: options.to,
    delimiter: options.delimiter || ',',
    quote: options.quote || '"',
    escape: options.escape || '"',
    columns: options.columns || true,
    skip_empty_lines: true,
    trim: true
  }));

  // Forward error from the read stream to the piped stream
  file.once('error', (error) => {
    // [Readable.destroy()](https://nodejs.org/dist/latest-v10.x/docs/api/stream.html#stream_readable_destroy_error) doesn't exist on Node.js 6.x LTS
    rows.emit('error', error);
  });

  const result = Stream.fromNativeStream(rows, (error) => {
    const displayedFilepath = process.env.NODE_ENV === 'test'
      ? path.relative('.', filepath)
      : /* istanbul ignore next */filepath;

    if (error.code === 'ENOENT') {
      throw new Error(`The "filepath" argument of the CSV helper refers to an unexisting file: "${displayedFilepath}".`);
    }
    /* istanbul ignore next */
    if (error.code === 'EACCES') {
      throw new Error(`The "filepath" argument of the CSV helper refers to a protected file: "${displayedFilepath}".`);
    }

    error.message = `Unable to parse the file "${displayedFilepath}" with the CSV helper. Reason:\n${error.message}`;

    throw error;
  });

  // Handling reading no line at all (`csv-parse` does not) while still checking the availability of the file
  return options.to === (options.from || 0) ? result.take(0) : result;
}

function validateArguments(filepath, options) {
  if (typeof filepath !== 'string') {
    return new TypeError(`The "filepath" argument of the CSV helper must be a "string". Received "${typeof filepath}".`);
  }

  const from = options.from;

  if (from !== undefined) {
    if (typeof from !== 'number') {
      return new TypeError(`The "from" option of the CSV helper must be a "number". Received "${typeof from}".`);
    }
    if (from < 0) {
      return new RangeError(`The "from" option of the CSV helper must be a positive integer. Received "${from}".`);
    }
  }

  const to = options.to;

  if (to !== undefined) {
    if (typeof to !== 'number') {
      return new TypeError(`The "to" option of the CSV helper must be a "number". Received "${typeof to}".`);
    }
    if (to < (from || 0)) {
      return new RangeError(`The "to" option of the CSV helper must be a positive integer and greater or equal to the "from" option. Received "${to}".`);
    }
  }

  const delimiter = options.delimiter;

  if (delimiter !== undefined) {
    if (typeof delimiter !== 'string') {
      return new TypeError(`The "delimiter" option of the CSV helper must be a "string". Received "${typeof delimiter}".`);
    }
    if (delimiter.length !== 1) {
      return new RangeError(`The "delimiter" option of the CSV helper must be a single character. Received "${delimiter}".`);
    }
  }

  const quote = options.quote;

  if (quote !== undefined) {
    if (typeof quote !== 'string') {
      return new TypeError(`The "quote" option of the CSV helper must be a "string". Received "${typeof quote}".`);
    }
    if (quote.length !== 1) {
      return new RangeError(`The "quote" option of the CSV helper must be a single character. Received "${quote}".`);
    }
  }

  const escape = options.escape;

  if (escape !== undefined) {
    if (typeof escape !== 'string') {
      return new TypeError(`The "escape" option of the CSV helper must be a "string". Received "${typeof escape}".`);
    }
    if (escape.length !== 1) {
      return new RangeError(`The "escape" option of the CSV helper must be a single character. Received "${escape}".`);
    }
  }

  const columns = options.columns;

  if (columns !== undefined) {
    if (!Array.isArray(columns)) {
      return new TypeError(`The "columns" option of the CSV helper must be an "array". Received "${typeof columns}".`);
    }
    if (columns.some(Utils.isNotString)) {
      return new TypeError(`The "columns" option of the CSV helper must only contain "string" value. Received ${JSON.stringify(JSON.stringify(columns))}.`);
    }
  }
}

module.exports = {
  stream
};
