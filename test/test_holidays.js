const createHolidays = require('../src/holidays');
const moment = require('moment-timezone');

describe('holidays.isHoliday(timestamp, location)', function() {
  let holidays;
  before(function() {
    holidays = createHolidays();
  });
  it('knows that 2014-12-25 is a holiday in Colombes', function() {
    const t = moment.tz('2014-12-25 12:00', 'Europe/Paris');
    return expect(holidays.isHoliday(t.unix(), { postalCode: '92700' })).to.be.eventually.true;
  });
  it('knows that 2016-01-01 is a holiday in Rennes', function() {
    const t = moment.tz('2014-01-01 12:00', 'Europe/Paris');
    return expect(holidays.isHoliday(t.unix(), { postalCode: '35000' })).to.be.eventually.true;
  });
  it('knows that 2017-02-23 is a holiday in Cherbourg and Lyon but not in Versailles', function() {
    const t = moment.tz('2017-02-23 12:00', 'Europe/Paris');
    return Promise.all([
      expect(holidays.isHoliday(t.unix(), { postalCode: '69000' })).to.be.eventually.true,
      expect(holidays.isHoliday(t.unix(), { postalCode: '50100' })).to.be.eventually.true,
      expect(holidays.isHoliday(t.unix(), { postalCode: '78000' })).to.be.eventually.false,
    ]);
  });
  it('knows that 2018-08-20 is a holiday in Perpignan and Point-à-Pitre but not in Saint-Denis (La Réunion)', function() {
    const t = moment.tz('2018-08-20 12:00', 'Europe/Paris');
    return Promise.all([
      expect(holidays.isHoliday(t.unix(), { postalCode: '66951' })).to.be.eventually.true,
      expect(holidays.isHoliday(t.unix(), { postalCode: '97110' })).to.be.eventually.true,
      expect(holidays.isHoliday(t.unix(), { postalCode: '97400' })).to.be.eventually.false,
    ]);
  });
});
