const buffer = require('most-buffer');
const luxon = require('luxon');
const most = require('most');
const nth = require('most-nth');


function formatTimezone(offset) {
  const offsetValue = Math.abs(offset);
  const hours = Math.floor(offsetValue / 60);

  return (Math.sign(offset) ? '+' : '-')
    + [hours, offsetValue - hours * 60].map((value) => String(value).padStart(2, 0)).join(':');
}

function isNull(value) { return value === null; }

function isPredictiveModel(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value._version === 'string'
    && typeof value.trees === 'object'
    && typeof value.configuration === 'object'
    && value.trees !== null
    && value.configuration !== null;
}

function isStream(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.pipe === 'function'
    && value.readable !== false
    && typeof value._read === 'function'
    && typeof value._readableState === 'object';
}

function parseDate(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return;

  return typeof value === 'string'
    ? DateTime.fromISO(value)
    : value instanceof Date
      ? DateTime.fromJSDate(value)
      : DateTime.fromMillis(value);
}

function parseTimestamp(value) {
  if (value === undefined) return value;

  const date = parseDate(value);

  if (date && date.isValid) return Math.floor(date.valueOf() / 1000);

  throw new Error();
}

function toBuffer(stream) {
  return stream.thru(buffer()).thru(nth.first);
}

function toStream(value) {
  if (isStream(value)) return fromStream(value);

  try {
    return most.from(value);
  } catch (error) {
    return most.throwError(error);
  }
}


function fromStream(value) {
  return most
    .fromEvent('data', value)
    .merge(most
      .fromEvent('error', value)
      .chain(most.throwError))
    .until(most
      .fromEvent('end', value)
      .take(1)
      // Prevent `end` event to close the stream before `error` event
      .delay(100));
}


const DateTime = luxon.DateTime;


module.exports = {
  formatTimezone,
  isNull,
  isPredictiveModel,
  isStream,
  parseDate,
  parseTimestamp,
  toBuffer,
  toStream,
};
