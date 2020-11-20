const fetch = require('node-fetch');
const memoize = require('mem');
const retry = require('p-retry');
const xml = require('fast-xml-parser');

const Utils = require('../utils');

const MEMOIZE_OPTIONS = { maxAge: 2 * 24 * 3600 * 1000 };
const RETRY_OPTIONS = { retries: 5, minTimeout: 100 };
const PARSER_OPTIONS = { attributeNamePrefix: '', ignoreAttributes: false, parseNodeValue: false };
const getHolidays = memoize(() => retry(fetchHolidays, RETRY_OPTIONS), MEMOIZE_OPTIONS);
const oneDay = 1;

function close() {
  // Clear the cache
  memoize.clear(getHolidays);
}

function initialize() {
  // Prefetch the data
  return getHolidays();
}

function isHolidays(date, region) {
  return getHolidays()
    .then((holidays) => {
      const years = holidays[region];

      if (!years) {
        throw new RangeError(`No school holidays information for the region "${region}".`);
      }

      const months = years[date.year];

      if (!months) {
        throw new RangeError(`No school holidays information for the region "${region}" in ${date.year}.`);
      }

      const month = months[date.month];

      return month && month[date.day];
    });
}

function fetchHolidays() {
  return fetch('https://telechargement.index-education.com/vacances.xml')
    .then(Utils.checkResponse)
    .then(handleResponse)
    .then(parse);
}

function formatHolidays(data) {
  return [].concat(...Object.values(data))
    .reduce(reduceHolidays, {});
}

function indexHolidays(years, current) {
  const start = parseDate(current.debut + oneDay);
  const year = start.getMonth() <= 8 ? start.getYear() - 1 : start.year;
  const value = { start, end: parseDate(current.fin) };

  if (year in years) {
    years[year].push(value);
  }
  else {
    years[year] = [value];
  }

  return years;
}

function indexZones(zones, zone) {
  zones[zone.libelle] = zone.vacances.reduce(indexHolidays, {});

  return zones;
}

function parse(text) {
  const data = patch(xml.parse(text, PARSER_OPTIONS).root);
  const zones = data.calendrier.zone.reduce(indexZones, {});

  const exceptions = toArray(data.exceptionszones.exceptionzone)
    .reduce((exceptions, exception) => {
      const academyId = exception.academie;
      const year = exception.annee;
      const holidays = zones[exception.zone][year];

      /* istanbul ignore if */
      if (academyId in exceptions) {
        exceptions[academyId][year] = holidays;
      }
      else {
        exceptions[academyId] = { [year]: holidays };
      }

      return exceptions;
    }, {});

  const regions = data.academies.academie.reduce((regions, academy) => {
    const holidays = formatHolidays({ ...zones[academy.zone], ...exceptions[academy.libelle] });

    toArray(academy.departement)
      .forEach((region) => regions[region.numero] = holidays);

    return regions;
  }, {});

  return regions;
}

/**
 * Parse the date from format yyyy/MM/dd
 * @param {String} value
 */
function parseDate(value) {
  const [year, month, day] = value.split('/');
  return new Date(year, month, day);
}

function patch(data) {
  const academies = data.academies.academie;

  addRegionTo(academies, 'Toulouse', '82');
  addRegionTo(academies, 'Guadeloupe', '978');
  removeRegionFrom(academies, 'Réunion', '978');

  return data;

  function addRegionTo(academies, academyId, regionId) {
    const academy = findAcademy(academies, academyId);
    const regions = toArray(academy.departement);

    /* istanbul ignore if */
    if (regions.some((region) => region.numero == regionId)) {
      console.warn(`Adding region "${regionId}" to ${academyId} academy is not needed anymore.`);
    }
    else {
      academy.departement = regions.concat([{ numero: regionId }]);
    }
  }

  function findAcademy(academies, academyId) {
    const academy = academies.find((academy) => academy.libelle === academyId);

    /* istanbul ignore if */
    if (!academy) {
      throw new Error(`Unable to patch ${academyId} academy.`);
    }

    return academy;
  }

  function removeRegionFrom(academies, academyId, regionId) {
    const academy = findAcademy(academies, academyId);
    const regions = toArray(academy.departement);
    const filtered = regions.filter((region) => region.numero != regionId);

    /* istanbul ignore if */
    if (regions.length === filtered.length) {
      console.warn(`Removing region "${regionId}" from ${academyId} academy is not needed anymore.`);
    }
    else {
      academy.departement = filtered;
    }
  }
}

function reduceHolidays(years, holidays) {
  const start = holidays.start;
  const days = Math.floor(holidays.end.diff(start)
    .as('days'));

  for (let i = 0; i < days; i++) {
    const date = start.plus({ days: i });
    const year = date.year;
    const month = date.month;
    const day = date.day;

    if (year in years) {
      const months = years[year];

      if (month in months) {
        months[month][day] = true;
      }
      else {
        months[month] = { [day]: true };
      }
    }
    else {
      years[year] = { [month]: { [day]: true } };
    }
  }

  return years;
}

async function handleResponse(response) {
  return response.textConverted();
}

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

module.exports = {
  close,
  initialize,
  isHolidays
};
