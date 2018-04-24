const lru = require('quick-lru');
const luxon = require('luxon');
const memoize = require('mem');


async function initialize(provider) {
  const options = provider.options;
  const country = options.country;

  if (typeof country !== 'string')
    throw new TypeError(`The "country" option of the public holiday provider must be a "string". Received "${typeof country}".`);

  const context = {};

  try {
    const holidays = require(`../../data/public_holiday.${country}.js`);
    // Add an empty element to make array indexes match month
    const fixed = [null].concat(holidays.fixed.map(indexArray));
    const easterOffseted = indexArray(holidays.easterOffseted);

    context.fixed = fixed;
    context.easterOffseted = easterOffseted;
    /* istanbul ignore next */
    context.regions = holidays.regions ? formatRegions(holidays.regions, fixed, easterOffseted) : {};
  } catch (error)/* istanbul ignore next */ {
    if (error.code === 'MODULE_NOT_FOUND')
      throw new RangeError(`The "country" option of the public holiday provider must be valid. Received "${country}".`);

    throw error;
  }

  const cache = new lru({ maxSize: 50 });

  context.cache = cache;
  context.easter = memoize(require('date-easter').easter, { cache });
  provider.context = context;
}

async function computeConfigurationExtension() {
  return {
    [HOLIDAY]: { type: 'enum' },
  };
}

async function computeRecordExtension(endpoint, date) {
  return {
    [HOLIDAY]: isHoliday.call(this, date, endpoint.metadata.region) ? 'YES' : 'NO',
  };
}

async function close() {
  /* Does nothing. */
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

function getEasterOffset(date) {
  const year = date.year;
  const easter = this.context.easter(year);

  return Math.floor(date.diff(DateTime.utc(year, easter.month, easter.day)).as('day'));
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

  const easterOffset = getEasterOffset.call(this, date);

  return holidays.easterOffseted[easterOffset];
}


const HOLIDAY = 'holiday';
const DateTime = luxon.DateTime;
const Indexer = indexWith(true);


module.exports = {
  close,
  computeConfigurationExtension,
  computeRecordExtension,
  initialize,
};
