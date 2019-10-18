const lru = require('quick-lru');
const luxon = require('luxon');
const memoize = require('mem');

const Constants = require('../constants');


async function initialize(provider) {
  const options = provider.options;
  const country = options.country;

  if (typeof country !== 'string')
    throw new TypeError(`The "country" option of the public holiday provider must be a "string". Received "${typeof country}".`);

  const context = provider.context;

  try {
    const holidays = require(`../data/public_holiday.${country}`);
    // Add an empty element to make array indexes match month
    const fixed = [null].concat(holidays.fixed.map(indexArray));
    const easterOffseted = indexArray(holidays.easterOffseted);

    context.fixed = fixed;
    context.easterOffseted = easterOffseted;
    context.regions = holidays.regions ? formatRegions(holidays.regions, fixed, easterOffseted) : /* istanbul ignore next */{};
  } catch (error)/* istanbul ignore next */ {
    if (error.code === 'MODULE_NOT_FOUND')
      throw new RangeError(`The "country" option of the public holiday provider must be valid. Received "${country}".`);

    throw error;
  }

  const cache = new lru({ maxSize: 50 });
  const easter = require('date-easter').easter;

  context.cache = cache;
  context.easter = memoize(getEasterDate, { cache });
  provider.refresh.period = 24 * 3600;


  function getEasterDate(year) {
    const date = easter(year);

    return DateTime.utc(year, date.month, date.day);
  }
}

async function extendConfiguration() {
  // TODO: Check the endpoint's metadata

  return {
    [HOLIDAY]: { type: 'enum' },
  };
}

async function extendRecord(endpoint, record) {
  return {
    [HOLIDAY]: isHoliday.call(this, record[PARSED_RECORD][DATE], endpoint.metadata.region) ? 'YES' : 'NO',
  };
}

async function close() {
  // Clear the cache
  this.context.cache.clear();
}


function formatRegions(regions, fixed, easterOffseted) {
  return regions.reduce((regions, element) => {
    const holidays = element[1];

    const regionalHolidays = {
      fixed: fixed.map((days, month) => month in holidays.fixed
        ? Object.assign(indexArray(holidays.fixed[month]), days)
        : days),
      easterOffseted: holidays.easterOffseted
        ? Object.assign(indexArray(holidays.easterOffseted), easterOffseted)
        : easterOffseted,
    };

    return Object.assign(regions, element[0].reduce(indexWith(regionalHolidays), {}));
  }, {});
}

function getRegionalHolidays(index) {
  const context = this.context;

  return index === undefined || index === null ? context : context.regions[index] || context;
}

function indexArray(array) {
  return array.reduce(Indexer, {});
}

function indexWith(value) {
  return function reducer(object, index) {
    object[index] = value;

    return object;
  };
}

function isHoliday(date, region) {
  const holidays = getRegionalHolidays.call(this, region);

  if (holidays.fixed[date.month][date.day]) return true;

  const easterDate = this.context.easter(date.year);
  // Comparison between easter and the current date needs to be done in the same timezone
  const easterOffset = Math.floor(date.setZone(UTC_ZONE, KEEP_LOCAL_TIME).diff(easterDate, 'days').days);

  return holidays.easterOffseted[easterOffset];
}


const PARSED_RECORD = Constants.PARSED_RECORD;
const DATE = Constants.DATE_FEATURE;
const KEEP_LOCAL_TIME = { keepLocalTime: true };
const UTC_ZONE = new luxon.IANAZone('utc');
// TODO: Accept custom context property name and labels
const HOLIDAY = 'public_holiday';
const DateTime = luxon.DateTime;
const Indexer = indexWith(true);


module.exports = {
  HOLIDAY,
  close,
  extendConfiguration,
  extendRecord,
  initialize,
};
