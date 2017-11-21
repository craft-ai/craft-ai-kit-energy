const createGeolocation = require('../src/geolocation');

describe('geolocation.locate({ postalCode })', function() {
  let geolocation;
  before(function() {
    geolocation = createGeolocation();
  });
  it('works on a 5-digits metropolitan postal code as a string', function() {
    return expect(geolocation.locate({ postalCode: '35000' })).to.be.eventually.deep.equal({
      postalCode: '35000',
      lat: 48.11157144,
      lon: -1.681685888
    });
  });
  it('works on a 5-digits caribbean postal code as a string', function() {
    return expect(geolocation.locate({ postalCode: '97200' })).to.be.eventually.deep.equal({
      postalCode: '97200',
      lat: 14.64087345,
      lon: -61.06917647
    });
  });
  it('works on a 4-digit postal code as a string', function() {
    return expect(geolocation.locate({ postalCode: '06500' })).to.be.eventually.deep.equal({
      postalCode: '06500',
      lat: 43.8363052,
      lon: 7.464967095
    });
  });
  it('works on a 5-digits postal code as a number', function() {
    return expect(geolocation.locate({ postalCode: 20169 })).to.be.eventually.deep.equal({
      postalCode: '20169',
      lat: 41.43552374,
      lon: 9.185657635
    });
  });
  it('works on a 4-digit postal code as a number', function() {
    return expect(geolocation.locate({ postalCode: 2100 })).to.be.eventually.deep.equal({
      postalCode: '02100',
      lat: 49.84726866,
      lon: 3.277922444
    });
  });
});
