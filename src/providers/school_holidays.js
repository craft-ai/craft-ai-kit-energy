const Constants = require('../constants');


async function initialize(provider) {
  const options = provider.options;
  const country = options.country;

  if (typeof country !== 'string')
    throw new TypeError(`The "country" option of the school holidays provider must be a "string". Received "${typeof country}".`);

  const context = provider.context;

  try {
    context.holidays = require(`../data/school_holidays.${country}`);
  } catch (error)/* istanbul ignore next */ {
    if (error.code === 'MODULE_NOT_FOUND')
      throw new RangeError(`The "country" option of the school holidays provider must be valid. Received "${country}".`);

    throw error;
  }

  provider.refresh.period = 24 * 3600;

  return context.holidays.initialize();
}

async function extendConfiguration() {
  // TODO: Check the endpoint's metadata

  return {
    [HOLIDAY]: { type: 'enum' },
  };
}

async function extendConfigurationOption() {
  return {};
}

async function extendRecord(endpoint, record) {
  return this.context.holidays
    .isHolidays(record[PARSED_RECORD][DATE], endpoint.metadata.region)
    .then(formatExtension)
    .catch((error) => {
      this.log(error.message);

      return UNKNOWN;
    });
}

async function close() {
  return this.context.holidays.close();
}


function formatExtension(isHolidays) {
  return { [HOLIDAY]: isHolidays ? 'YES' : 'NO', };
}


const PARSED_RECORD = Constants.PARSED_RECORD;
const DATE = Constants.DATE_FEATURE;
// TODO: Accept custom context property name and labels
const HOLIDAY = 'school_holiday';
const UNKNOWN = { [HOLIDAY]: 'UNKNOWN' };


module.exports = {
  HOLIDAY,
  close,
  extendConfiguration,
  extendConfigurationOption,
  extendRecord,
  initialize,
};
