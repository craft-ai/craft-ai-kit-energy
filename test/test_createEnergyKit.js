const createEnergyKit = require('../src');

describe('createEnergyKit(cfg)', function() {
  it('fails when a bad craft ai token is provided', function() {
    expect(() => createEnergyKit({
      token: 'I am a bad, bad token',
      darkSkySecretKey: process.env.DARK_SKY_SECRET_KEY
    })).to.throw();
  });
  it('succeeds when no DarkSky secret key token is provided', function() {
    const kit = createEnergyKit({
      token: process.env.CRAFT_TOKEN
    });
    expect(kit).to.be.ok;
    expect(kit.cfg.token).to.be.equal(process.env.CRAFT_TOKEN);
    expect(kit.cfg.weatherCache).to.be.undefined;
    return kit.terminate();
  });
  it('succeeds when a valid configuration is provided', function() {
    const kit = createEnergyKit({
      token: process.env.CRAFT_TOKEN,
      darkSkySecretKey: process.env.DARK_SKY_SECRET_KEY,
      weatherCache: weatherCache
    });
    expect(kit).to.be.ok;
    expect(kit.cfg.token).to.be.equal(process.env.CRAFT_TOKEN);
    expect(kit.cfg.weatherCache).to.be.equal(weatherCache);
    return kit.terminate();
  });
});

