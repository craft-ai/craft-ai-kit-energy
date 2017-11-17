const { Time } = require('craft-ai');
const createEnergyKit = require('../src');
const most = require('most');

const TEST_USER = {
  id: `test_update_user_${RUN_ID}`,
  location: {
    postalCode: '75013'
  }
};
const TEST_DATA = require('./data/test.data.json');

const TEST_DATA_WITH_WEATHER = require('./data/test_weather.data.json');

const TEST_USER_EXPECTED_AGENT_ID = `energy-test-update-user-${RUN_ID}`;
const TEST_USER_EXPECTED_LAT = '48.82827065';
const TEST_USER_EXPECTED_LON = '2.362358986';

describe('update(user, data)', function() {
  let kit;
  beforeEach(function() {
    kit = createEnergyKit({
      token: process.env.CRAFT_TOKEN,
      darkSkySecretKey: process.env.DARK_SKY_SECRET_KEY,
      weatherCache: weatherCache
    });

    return kit.clients.craftai.deleteAgent(TEST_USER_EXPECTED_AGENT_ID);
  });
  afterEach(function() {
    return kit.terminate();
  });
  it('fails when no user is provided', function() {
    return expect(kit.update(undefined, TEST_DATA)).to.be.rejected;
  });
  it('succeeds when no data is provided', function() {
    return kit.update(TEST_USER)
      .then((user) => {
        expect(user).to.be.deep.equal({
          id: TEST_USER.id,
          agentId: TEST_USER_EXPECTED_AGENT_ID,
          location: {
            postalCode: TEST_USER.location.postalCode,
            lat: TEST_USER_EXPECTED_LAT,
            lon: TEST_USER_EXPECTED_LON
          },
          firstTimestamp: undefined,
          lastTimestamp: undefined
        });

        // Check that the agent actually exists.
        return expect(kit.clients.craftai.getAgent(user.agentId)).to.be.fulfilled;
      });
  });
  it('fails when the user postal code is unknown', function() {
    const invalidPostalCodeUser = {
      id: TEST_USER.id,
      location: {
        postalCode: 'I am an invalid postal code'
      }
    };
    return expect(kit.update(invalidPostalCodeUser)).to.be.rejected;
  });
  it('succeeds when data is provided', function() {
    this.timeout(20000);
    return kit.update(TEST_USER, TEST_DATA)
      .then((user) => {
        expect(user).to.be.deep.equal({
          id: TEST_USER.id,
          agentId: TEST_USER_EXPECTED_AGENT_ID,
          location: {
            postalCode: TEST_USER.location.postalCode,
            lat: TEST_USER_EXPECTED_LAT,
            lon: TEST_USER_EXPECTED_LON
          },
          firstTimestamp: Time(TEST_DATA[0].date).timestamp,
          lastTimestamp: Time(TEST_DATA[TEST_DATA.length - 1].date).timestamp
        });

        // Check that the agent actually exists.
        return expect(kit.clients.craftai.getAgent(user.agentId)).to.be.fulfilled;
      });
  });
});

describe('update(user, data) /NO WEATHER ACCESS/', function() {
  let kit;
  beforeEach(function() {
    kit = createEnergyKit({
      token: process.env.CRAFT_TOKEN
    });

    return kit.clients.craftai.deleteAgent(TEST_USER_EXPECTED_AGENT_ID);
  });
  afterEach(function() {
    return kit.terminate();
  });
  it('succeeds when data is provided as a stream', function() {
    this.timeout(20000);
    return kit.update(TEST_USER, most.from(TEST_DATA_WITH_WEATHER))
      .then((user) => {
        expect(user).to.be.deep.equal({
          id: TEST_USER.id,
          agentId: TEST_USER_EXPECTED_AGENT_ID,
          location: {
            postalCode: TEST_USER.location.postalCode,
            lat: TEST_USER_EXPECTED_LAT,
            lon: TEST_USER_EXPECTED_LON
          },
          firstTimestamp: Time(TEST_DATA_WITH_WEATHER[0].date).timestamp,
          lastTimestamp: Time(TEST_DATA_WITH_WEATHER[TEST_DATA_WITH_WEATHER.length - 1].date).timestamp
        });

        // Check that the agent actually exists.
        return expect(kit.clients.craftai.getAgent(user.agentId)).to.be.fulfilled;
      });
  });
  it('succeeds when data some is provided twice', function() {
    this.timeout(20000);
    return kit.update(TEST_USER, most.from(TEST_DATA_WITH_WEATHER).take(30))
      .then(() => kit.update(TEST_USER, most.from(TEST_DATA_WITH_WEATHER).skip(20)))
      .then((user) => {
        expect(user).to.be.deep.equal({
          id: TEST_USER.id,
          agentId: TEST_USER_EXPECTED_AGENT_ID,
          location: {
            postalCode: TEST_USER.location.postalCode,
            lat: TEST_USER_EXPECTED_LAT,
            lon: TEST_USER_EXPECTED_LON
          },
          firstTimestamp: Time(TEST_DATA_WITH_WEATHER[0].date).timestamp,
          lastTimestamp: Time(TEST_DATA_WITH_WEATHER[TEST_DATA_WITH_WEATHER.length - 1].date).timestamp
        });

        // Check that the agent actually exists.
        return expect(kit.clients.craftai.getAgent(user.agentId)).to.be.fulfilled;
      });
  });
  it('succeeds when initial data are not complete', function() {
    this.timeout(20000);
    return kit.update(TEST_USER, most.from(TEST_DATA_WITH_WEATHER).skip(1))
      .then((user) => {
        expect(user).to.be.deep.equal({
          id: TEST_USER.id,
          agentId: TEST_USER_EXPECTED_AGENT_ID,
          location: {
            postalCode: TEST_USER.location.postalCode,
            lat: TEST_USER_EXPECTED_LAT,
            lon: TEST_USER_EXPECTED_LON
          },
          firstTimestamp: Time('2017-07-30T22:00:00.000Z').timestamp,
          lastTimestamp: Time(TEST_DATA_WITH_WEATHER[TEST_DATA_WITH_WEATHER.length - 1].date).timestamp
        });

        // Check that the agent actually exists.
        return expect(kit.clients.craftai.getAgent(user.agentId)).to.be.fulfilled;
      });
  });
});
