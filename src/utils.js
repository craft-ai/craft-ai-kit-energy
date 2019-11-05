const lru = require('quick-lru');
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

function checkZone(zone) {
  if (ZONE_CACHE.has(zone)) {
    return true;
  }

  const date = DateTime.fromObject({ zone });

  return date.isValid && Boolean(ZONE_CACHE.set(zone, date.zone));
}

function formatTimezone(offset) {
  const offsetValue = Math.abs(offset);
  const hours = Math.floor(offsetValue / 60);

  return (Math.sign(offset) >= 0 ? '+' : '-')
    + [hours, offsetValue - hours * 60].map((value) => String(value)
      .padStart(2, 0))
      .join(':');
}

function getDateWindow(date, origin, period) {
  const rounded = roundDate(date, origin, period);
  const nextDate = Number.isFinite(period) ? rounded.plus(period) : rounded;
  const timezoneDiff = (nextDate.offset - rounded.offset) * 60 * 1000;

  return [rounded, nextDate.minus(timezoneDiff)];
}

function isNull(value) {
  return value === null;
}

function isNotNull(value) {
  return value !== null;
}

function isNotString(value) {
  return typeof value !== 'string';
}

function isPredictiveModel(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value._version === 'string'
    && typeof value.trees === 'object'
    && typeof value.configuration === 'object'
    && value.trees !== null
    && value.configuration !== null;
}

function modulo(a, b) {
  const mod = a % b;

  return mod < 0 ? mod + b : mod;
}

function parseDate(value) {
  return value === null || value === undefined || typeof value === 'boolean'
    ? DateTime.invalid('wrong type')
    : typeof value === 'string'
      ? DateTime.fromISO(value, { setZone: true })
      : value instanceof Date
        ? DateTime.fromJSDate(value)
        : typeof value === 'number' ? DateTime.fromMillis(value) : value;
}

function parseDuration(value) {
  return value === null || value === undefined || typeof value === 'boolean'
    ? Duration.invalid('wrong type')
    : typeof value === 'string'
      ? Duration.fromISO(value)
      : typeof value === 'object'
        ? Duration.fromObject(value)
        : typeof value === 'number' ? Duration.fromMillis(value) : value;
}

function parseNumber(value) {
  const result = value && typeof value === 'string' ? Number(value.replace(',', '.')) : value;

  return Number.isFinite(result) ? result : undefined;
}

function parseTimestamp(value) {
  if (value === undefined || value === null) {
    return;
  }

  const date = parseDate(value);

  if (!date.isValid) {
    throw new Error('Invalid date');
  }

  return Math.floor(date.valueOf() / 1000);
}

function roundDate(date, origin, period) {
  // Timezone offset is in minutes
  const timeDifference = date - origin + (date.offset - origin.offset) * 60 * 1000;
  // Returned date is inferior or equal to "date" by design (positive modulo)
  const remainder = modulo(timeDifference, period);
  return Number.isFinite(remainder) ? date.minus(remainder) : date;
}

function setZone(date, zone) {
  if (!zone || !date.isValid) {
    return date;
  }

  if (ZONE_CACHE.has(zone)) {
    return date.setZone(ZONE_CACHE.get(zone));
  }

  const result = date.setZone(zone);

  ZONE_CACHE.set(zone, result.zone);

  return result;
}

const ZONE_CACHE = new lru({ maxSize: 50 });
const DateTime = luxon.DateTime;
const Duration = luxon.Duration;

module.exports = {
  checkResponse,
  checkZone,
  formatTimezone,
  getDateWindow,
  handleResponse,
  isNotNull,
  isNull,
  isNotString,
  isPredictiveModel,
  modulo,
  parseDate,
  parseDuration,
  parseNumber,
  parseTimestamp,
  roundDate,
  setZone
};
