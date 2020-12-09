const lru = require('quick-lru');
const dateFns = require('date-fns-tz');

const ZONE_CACHE = new lru({ maxSize: 50 });

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

  try {
    dateFns.toDate(Date.now(), { timeZone: zone });
    ZONE_CACHE.set(zone, zone);
    return true;
  }
  catch (err) {
    return false;
  }
}

function formatTimezone(offset) {
  const offsetValue = Math.abs(offset);
  const hours = Math.floor(offsetValue / 60);

  return (Math.sign(offset) >= 0 ? '+' : '-')
    + [hours, offsetValue - hours * 60].map((value) => String(value)
      .padStart(2, 0))
      .join(':');
}

/**
 * Get the previous and next period dates for the actual date
 *
 * @param {Date} date actual date in TZ
 * @param {Date} origin origin date in UTC
 * @param {Number} period period in ms
 * @param {Date} tzOfDate timezone for the date
 *
 * @returns {[
 *  previousPeriodTimestampInMs: Number,
 *  nextPeriodTimestampInMs: Number
 * ]} Timestamp align with the period and the date of the new period. Timestamp are return in the TZ
 */
function getDateWindow(date, origin, period, tzOfDate) {
  const periodInSec = period / 1000;
  const originInTz = dateFns.toDate(origin, { timeZone: tzOfDate });
  const rounded = roundDate(date, originInTz.getTime() / 1000, periodInSec);
  const nextDate = Number.isFinite(periodInSec) ?
    dateFns
      .toDate(rounded + periodInSec, { timeZone: tzOfDate })
      .getTime()
    : rounded;

  return [rounded, nextDate];
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

function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

function parseDate(value) {
  if (value === null
    || value === undefined
    || typeof value === 'boolean'
    || value instanceof Function) {
    throw new Error(`InvalidDate. Given ${value}.`);
  }
  else if (typeof value === 'string') {
    const date = new Date(value);

    if (!isValidDate(date)) {
      throw new Error(`InvalidDate. Given ${value}.`);
    }
    return date;
  }
  else if (typeof value === 'number') {
    const date = new Date(value);

    if (!isValidDate(date)) {
      throw new Error(`InvalidDate. Given ${value}.`);
    }
    return date;
  }
  return  value;
}

// function parseDuration(value) {
//   return value === null || value === undefined || typeof value === 'boolean'
//     ? Duration.invalid('wrong type')
//     : typeof value === 'string'
//       ? Duration.fromISO(value)
//       : typeof value === 'object'
//         ? Duration.fromObject(value)
//         : typeof value === 'number' ? Duration.fromMillis(value) : value;
// }

function parseNumber(value) {
  const result = value && typeof value === 'string' ? Number(value.replace(',', '.')) : value;

  return Number.isFinite(result) ? result : undefined;
}

function parseTimestamp(value) {
  if (value === undefined || value === null) {
    return;
  }

  try {
    const date = parseDate(value);
    return Math.floor(date.valueOf() / 1000);
  }
  catch (err) {
    throw err;
  }
}

/**
 * Put the actual date on the period
 *
 * @param {Date} date actual date
 * @param {Date} origin origin date
 * @param {Number} period period in seconds
 *
 * @returns {Date} date aligned the period
 */
function roundDate(date, origin, period) {
  // Timezone offset is in minutes
  const timeDifference = date - origin;
  // Returned date is inferior or equal to "date" by design (positive modulo)
  const remainder = modulo(timeDifference, period);
  return Number.isFinite(remainder) ? date - remainder : date;
}

function setZone(date, zone) {
  if (!zone) {
    return date;
  }

  if (ZONE_CACHE.has(zone)) {
    return dateFns.utcToZonedTime(date, ZONE_CACHE.get(zone));
  }

  ZONE_CACHE.set(zone, zone);

  return dateFns.utcToZonedTime(date, zone);
}

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
  // parseDuration,
  parseNumber,
  parseTimestamp,
  roundDate,
  setZone
};
