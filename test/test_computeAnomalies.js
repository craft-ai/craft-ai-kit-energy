const createEnergyKit = require('../src');
const { Time } = require('craft-ai');

const TEST_USER = {
  id: `test_update_user_${RUN_ID}`,
  location: {
    postalCode: '75013'
  }
};
const TEST_USER_AGENT_ID = `energy-test-update-user-${RUN_ID}`;
const TEST_DATA = require('./data/test_weather.data.json');
const TEST_DATA_TO = Time(TEST_DATA[TEST_DATA.length - 1].date);

describe('computeAnomalies(user, cfg)', function() {
  let kit;
  before(function() {
    kit = createEnergyKit({
      token: process.env.CRAFT_TOKEN
    });

    return kit.clients.craftai.deleteAgent(TEST_USER_AGENT_ID)
      .then(() => kit.update(TEST_USER, TEST_DATA));
  });
  after(function() {
    return kit.terminate();
  });
  it('fails when no cfg is provided', function() {
    return expect(kit.computeAnomalies(TEST_USER, undefined)).to.be.rejected;
  });
  it('succeeds when a cfg is provided', function() {
    return kit.computeAnomalies(TEST_USER, {
      to: TEST_DATA_TO.timestamp,
      from: TEST_DATA_TO.timestamp - 24 * 60 * 60
    })
      .then(({ anomalies, anomalyRatio }) => {
        expect(anomalies).to.have.lengthOf(8);
        expect(anomalyRatio).to.be.within(0.16, 0.17);
      });
  });
});