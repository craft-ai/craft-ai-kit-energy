const createEnergyKit = require('../src');
const { Time } = require('craft-ai');

const TEST_USER = {
  id: `test_update_user_${RUN_ID}`,
  location: {
    postalCode: '75013'
  }
};
const TEST_USER_DATA = require('./data/test.data.json');
const TEST_USER_DATA_TO = Time(TEST_USER_DATA[TEST_USER_DATA.length - 1].date);


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
    return expect(kit.update(undefined, TEST_USER_DATA)).to.be.rejected;
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
    return kit.update(TEST_USER, TEST_USER_DATA)
      .then((user) => {
        expect(user).to.be.deep.equal({
          id: TEST_USER.id,
          agentId: TEST_USER_EXPECTED_AGENT_ID,
          location: {
            postalCode: TEST_USER.location.postalCode,
            lat: TEST_USER_EXPECTED_LAT,
            lon: TEST_USER_EXPECTED_LON
          },
          lastTimestamp: TEST_USER_DATA_TO.timestamp
        });

        // Check that the agent actually exists.
        return expect(kit.clients.craftai.getAgent(user.agentId)).to.be.fulfilled;
      });
  });
});
