const buffer = require('most-buffer');
const most = require('most');
const isFunction = require('lodash.isfunction');

function from(value, options) {
  if (isStream(value)) {
    return fromNativeStream(value);
  }
  if (typeof value === 'string') {
    return fromCsv(value, options);
  }

  try {
    return most.from(value);
  }
  catch (error) {
    return most.throwError(error);
  }
}

function fromNativeStream(value, errorHandler = most.throwError) {
  return most
    .fromEvent('error', value)
    .chain(errorHandler)
    .merge(most.fromEvent('data', value))
    .until(most.fromEvent('end', value));
}

function isStream(value) {
  return value !== null
    && typeof value === 'object'
    && isFunction(value.pipe)
    && value.readable !== false
    && isFunction(value._read)
    && typeof value._readableState === 'object';
}

function toBuffer(stream) {
  return stream
    .thru(buffer())
    .reduce((_, buffer) => buffer, []);
}

function fromCsv(value, options) {
  return require('./parsers/csv')
    .stream(value, options);
}

module.exports = {
  fromNativeStream,
  from,
  isStream,
  toBuffer
};
