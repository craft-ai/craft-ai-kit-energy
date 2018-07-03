async function initialize(provider) {
  const options = provider.options;
  const country = options.country;

  if (typeof country !== 'string')
    throw new TypeError(`The "country" option of the school holidays provider must be a "string". Received "${typeof country}".`);

  const context = {};

  try {
    context.holidays = require(`../../data/school_holidays.${country}.js`);
  } catch (error)/* istanbul ignore next */ {
    if (error.code === 'MODULE_NOT_FOUND')
      throw new RangeError(`The "country" option of the school holidays provider must be valid. Received "${country}".`);

    throw error;
  }

  provider.context = context;

  return context.holidays.initialize();
}

async function extendConfiguration() {
  return {
    [HOLIDAY]: { type: 'enum' },
  };
}

async function extendRecord(endpoint, date) {
  return this.context.holidays
    .isHolidays(date, endpoint.metadata.region)
    .then(formatRecordExtension)
    .catch((error) => {
      this.log(error.message);

      return UNKNOWN;
    });
}

async function close() {
  return this.context.holidays.close();
}


function formatRecordExtension(isHolidays) {
  return { [HOLIDAY]: isHolidays ? 'YES' : 'NO', };
}


const HOLIDAY = 'holiday';
const UNKNOWN = { [HOLIDAY]: 'UNKNOWN' };


module.exports = {
  close,
  extendConfiguration,
  extendRecord,
  initialize,
};
