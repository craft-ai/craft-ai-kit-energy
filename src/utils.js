const luxon = require('luxon');
const retry = require('p-retry');


async function checkResponse(response) {
  const status = response.status;

  /* istanbul ignore next */
  return status < 500
    ? status < 400 ? response : retry.AbortError(response)
    : Promise.reject(response);
}

function formatTimezone(offset) {
  const offsetValue = Math.abs(offset);
  const hours = Math.floor(offsetValue / 60);

  return (Math.sign(offset) ? '+' : '-')
    + [hours, offsetValue - hours * 60].map((value) => String(value).padStart(2, 0)).join(':');
}

function isNotUndefined(value) { return value !== undefined; }

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

function isNotString(value) { return typeof value !== 'string'; }

function parseDate(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return;

  return typeof value === 'string'
    ? DateTime.fromISO(value)
    : value instanceof Date
      ? DateTime.fromJSDate(value)
      : typeof value === 'number' ? DateTime.fromMillis(value) : value;
}

function parseNumber(value) {
  const result = value && typeof value === 'string' ? Number(value.replace(',', '.')) : value;

  return Number.isFinite(result) ? result : undefined;
}

function parseTimestamp(value) {
  if (value === undefined || value === null) return;

  const date = parseDate(value);

  if (date && date.isValid) return Math.floor(date.valueOf() / 1000);

  throw new Error();
}


const DateTime = luxon.DateTime;


module.exports = {
  checkResponse,
  formatTimezone,
  isNotUndefined,
  isNull,
  isPredictiveModel,
  isNotString,
  parseDate,
  parseNumber,
  parseTimestamp,
};
