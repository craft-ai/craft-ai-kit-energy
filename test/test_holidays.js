const _ = require('lodash');
const createHolidays = require('../src/holidays');
const moment = require('moment-timezone');

const DEPARTMENTS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
  '59',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '68',
  '69',
  '70',
  '71',
  '72',
  '73',
  '74',
  '75',
  '76',
  '77',
  '78',
  '79',
  '80',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '971',
  '972',
  '973',
  '974',
  '976'
];

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
  it('knows that 2017-02-23 is a holiday in Cherbourg and Lyon but not in Versailles, Toulouse', function() {
    const t = moment.tz('2017-02-23 12:00', 'Europe/Paris');
    return Promise.all([
      expect(holidays.isHoliday(t.unix(), { postalCode: '69000' })).to.be.eventually.true,
      expect(holidays.isHoliday(t.unix(), { postalCode: '50100' })).to.be.eventually.true,
      expect(holidays.isHoliday(t.unix(), { postalCode: '78000' })).to.be.eventually.false,
      expect(holidays.isHoliday(t.unix(), { postalCode: '31000' })).to.be.eventually.false
    ]);
  });
  it('knows that 2017-02-15 is a holiday in Toulouse and Montauban', function() {
    const t = moment.tz('2017-02-15 12:00', 'Europe/Paris');
    return Promise.all([
      expect(holidays.isHoliday(t.unix(), { postalCode: '31000' })).to.be.eventually.true,
      expect(holidays.isHoliday(t.unix(), { postalCode: '82000' })).to.be.eventually.true
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
  it('works on all department capitals', function() {
    const t = moment.tz('2017-02-15 12:00', 'Europe/Paris');
    return Promise.all(DEPARTMENTS.map(
      (department) => expect(holidays.isHoliday(
        t.unix(),
        { postalCode: _.padEnd(department, 5, '0') })
      ).to.be.fulfilled)
    );
  });
});
