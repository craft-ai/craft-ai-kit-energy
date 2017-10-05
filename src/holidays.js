const _ = require('lodash');
const debug = require('debug')('craft-ai:kit-energy:holidays');
const fetch = require('node-fetch');
const getEaster = require('date-easter').easter;
const moment = require('moment-timezone');
const xml = require('fast-xml-parser');

const DATE_FORMAT = 'YYYY/MM/DD';

const computeFrenchPublicHolidays = _.memoize((year) => {
  debug(`Retrieving French public holidays for ${year}...`);
  // Postal code is ignored, we don't take into account local specificities yet.

  const rawEaster = getEaster(year);
  rawEaster.month--;
  const easter = moment.tz(rawEaster, 'Europe/Paris');

  return [
    moment.tz({ year, month: 0, day: 1 }, 'Europe/Paris'),    // Nouvel an
    moment.tz({ year, month: 4, day: 1 }, 'Europe/Paris'),    // Fête du travail
    moment.tz({ year, month: 4, day: 8 }, 'Europe/Paris'),    // Victoire 1945
    moment.tz({ year, month: 6, day: 14 }, 'Europe/Paris'),   // Fête nationale
    moment.tz({ year, month: 10, day: 11 }, 'Europe/Paris'),  // Armistice
    easter,                                                   // Pâques
    easter.clone().add(1, 'days'),                            // Lundi de Pâques
    easter.clone().add(39, 'days'),                           // Ascension
    easter.clone().add(49, 'days'),                           // Pentecôte
    easter.clone().add(50, 'days'),                           // Lundi de Pentecôte
    moment.tz({ year, month: 7, day: 15 }, 'Europe/Paris'),   // Assomption
    moment.tz({ year, month: 10, day: 1 }, 'Europe/Paris'),   // Toussaint
    moment.tz({ year, month: 11, day: 25 }, 'Europe/Paris')   // Noël
  ];
});


function fetchFrenchSchoolHolidays() {
  debug('Retrieving French school holidays...');
  return fetch('https://telechargement.index-education.com/vacances.xml')
    .then((res) => res.text())
    .then((data) => xml.parse(data, {
      attrPrefix: '',
      ignoreTextNodeAttr: false,
      ignoreNonTextNodeAttr: false,
      ignoreNameSpace: false
    }).root)
    .then((data) => {
      const departmentToZone = data.academies.academie.reduce((departmentToZone, { departement, zone }) => {
        if (Array.isArray(departement)) {
          departement.forEach((departement) => departmentToZone[departement.numero] = zone);
        } else {
          departmentToZone[departement.numero] = zone;
        }

        return departmentToZone;
      }, {});

      const zoneToCalendar = data.calendrier.zone.reduce((zoneToCalendar, { libelle, vacances }) => {
        zoneToCalendar[libelle] = vacances.map(({ debut, fin }) => ([
          moment.tz(debut, DATE_FORMAT, 'Europe/Paris').startOf('day'),
          moment.tz(fin, DATE_FORMAT, 'Europe/Paris').endOf('day')
        ]));
        return zoneToCalendar;
      }, {});

      return [departmentToZone, zoneToCalendar];
    })
    .catch((error) => {
      debug('Error retrieving school calendar', error);
      throw error;
    });
}

function createHolidays() {
  const frenchSchoolHolidaysPromise = fetchFrenchSchoolHolidays();
  const retrieveHolidays = _.memoize((year, postalCode) => {
    return frenchSchoolHolidaysPromise
      .then(([departmentToZone, zoneToCalendar]) => {
      // Checks for 2 digits department number first and if not found checks 3 digits ones
        const zone = departmentToZone[postalCode.slice(0, 2)] || departmentToZone[postalCode.slice(0, 3)];

        if (!zone) {
          return Promise.reject(Error(`Cannot find school holiday zone for postal code ${postalCode}`));
        }

        const schoolHolidays = _.filter(zoneToCalendar[zone], ([from, to]) => from.year() === year || to.year() === year);
        const publicHolidays = _.map(computeFrenchPublicHolidays(year, postalCode), (day) => ([day.startOf('day'), day.endOf('day')]));
        const holidays = schoolHolidays.concat(publicHolidays);
        return holidays;
      });
  },
  (year, postalCode) => `${year}-${postalCode}`);
  return {
    isHoliday: (timestamp, postalCode) => {
      const year = moment.unix(timestamp).tz('Europe/Paris').year();
      return retrieveHolidays(year, postalCode)
        .then((holidays) =>
          holidays.some(([from, to]) => from.unix() < timestamp && timestamp < to.unix())
        );
    }
  };
}

module.exports = createHolidays;
