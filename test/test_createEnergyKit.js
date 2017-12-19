const createEnergyKit = require('../src');

describe('createEnergyKit(cfg)', function() {
  it('fails when a bad craft ai token is provided', function() {
    expect(() => createEnergyKit({
      token: 'I am a bad, bad token',
      darkSkySecretKey: process.env.DARK_SKY_SECRET_KEY
    })).to.throw();
  });
  it('fails when a bad relative deviation threshold is provided', function() {
    expect(() => createEnergyKit({
      token: process.env.CRAFT_TOKEN,
      darkSkySecretKey: process.env.DARK_SKY_SECRET_KEY,
      sigmaDeviationThreshold: 'blop'
    })).to.throw();
    expect(() => createEnergyKit({
      token: process.env.CRAFT_TOKEN,
      darkSkySecretKey: process.env.DARK_SKY_SECRET_KEY,
      sigmaDeviationThreshold: -2
    })).to.throw();
  });
  it('fails when a bad confidence threshold is provided', function() {
    expect(() => createEnergyKit({
      token: process.env.CRAFT_TOKEN,
      darkSkySecretKey: process.env.DARK_SKY_SECRET_KEY,
      confidenceThreshold: 'foobar'
    })).to.throw();
    expect(() => createEnergyKit({
      token: process.env.CRAFT_TOKEN,
      darkSkySecretKey: process.env.DARK_SKY_SECRET_KEY,
      confidenceThreshold: 1
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
    expect(kit.cfg.sigmaDeviationThreshold).to.be.equal(2);
    expect(kit.cfg.confidenceThreshold).to.be.equal(0.4);
    return kit.terminate();
  });

  it('succeeds when provided with valid non-default values', function() {
    const kit = createEnergyKit({
      token: process.env.CRAFT_TOKEN,
      darkSkySecretKey: process.env.DARK_SKY_SECRET_KEY,
      weatherCache: weatherCache,
      sigmaDeviationThreshold: 1.3,
      confidenceThreshold: 0.4
    });
    expect(kit).to.be.ok;
    expect(kit.cfg.token).to.be.equal(process.env.CRAFT_TOKEN);
    expect(kit.cfg.weatherCache).to.be.equal(weatherCache);
    expect(kit.cfg.sigmaDeviationThreshold).to.be.equal(1.3);
    expect(kit.cfg.confidenceThreshold).to.be.equal(0.4);
    return kit.terminate();
  });
});

