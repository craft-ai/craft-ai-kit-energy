const luxon = require('luxon');


async function checkResponse(response) {
  const status = response.status;

  /* istanbul ignore next */
  return status < 500 ? response : Promise.reject(response);
}

async function handleResponse(response) {
  /* istanbul ignore next */
  return response.status < 400 ? response : Promise.reject(response);
}

function formatTimezone(offset) {
  const offsetValue = Math.abs(offset);
  const hours = Math.floor(offsetValue / 60);

  return (Math.sign(offset) ? '+' : '-')
    + [hours, offsetValue - hours * 60].map((value) => String(value).padStart(2, 0)).join(':');
}

function getInterval(origin, period, date, previous) {
  if (!previous) previous = date.set(origin).minus(period);

  return previous.until(date);
}

function isNull(value) { return value === null; }

function isNotNull(value) { return value !== null; }

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

function roundDate(interval, period, previous) {
  const intervals = interval.splitBy(period);
  const lastInterval = intervals[intervals.length - 1];

  return previous ? lastInterval.end : lastInterval.start;
}


const DateTime = luxon.DateTime;


module.exports = {
  checkResponse,
  formatTimezone,
  getInterval,
  handleResponse,
  isNotNull,
  isNull,
  isPredictiveModel,
  isNotString,
  parseDate,
  parseNumber,
  parseTimestamp,
  roundDate,
};
