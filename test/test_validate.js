const createEnergyKit = require('../src');

const TEST_USER = {
  id: `test_validate_user_${RUN_ID}`,
  location: {
    postalCode: '75013'
  }
};
const TEST_USER_AGENT_ID = `energy-test-validate-user-${RUN_ID}`;
const TEST_DATA = require('./data/test_weather.data.json');

describe('validate(user, {window, windowsCount})', function() {
  let kit;
  before(function() {
    kit = createEnergyKit({
      token: process.env.CRAFT_TOKEN,
      absoluteDeviationThreshold: 500
    });

    return kit.clients.craftai.deleteAgent(TEST_USER_AGENT_ID)
      .then(() => kit.update(TEST_USER, TEST_DATA));
  });
  after(function() {
    return kit.terminate();
  });
  it('succeeds with the default arguments', function() {
    return kit.validate(TEST_USER)
      .then(({ user, validations }) => {
        expect(user.id).to.be.equal(TEST_USER.id);
        expect(validations).to.have.lengthOf(7);
        expect(validations[0]).to.be.deep.equal({
          count: 337,
          from: 1501882200,
          meanPredictedRange: 210.03027952522217,
          overestimated: 0.22255192878338279,
          to: 1502487000,
          underestimated: 0.29376854599406527,
          unknown: 0,
          valid: 0.4836795252225519
        });
        expect(validations[6]).to.be.deep.equal({
          count: 289,
          from: 1505511000,
          meanPredictedRange: 391.28417869824662,
          overestimated: 0.15570934256055363,
          to: 1506115800,
          underestimated: 0.08996539792387544,
          unknown: 0.01384083044982699,
          valid: 0.740484429065744
        });
        expect(validations[0].valid).to.be.within(0.48, 0.49);
        expect(validations[0].meanPredictedRange).to.be.within(210, 211);
        expect(validations[1].valid).to.be.within(0.75, 0.76);
        expect(validations[1].meanPredictedRange).to.be.within(346, 347);
        expect(validations[2].valid).to.be.within(0.77, 0.78);
        expect(validations[2].meanPredictedRange).to.be.within(395, 396);
        expect(validations[3].valid).to.be.within(0.73, 0.74);
        expect(validations[3].meanPredictedRange).to.be.within(392, 393);
        expect(validations[4].valid).to.be.within(0.82, 0.83);
        expect(validations[4].meanPredictedRange).to.be.within(388, 389);
        expect(validations[5].valid).to.be.within(0.75, 0.76);
        expect(validations[5].meanPredictedRange).to.be.within(293, 294);
        expect(validations[6].valid).to.be.within(0.74, 0.75);
        expect(validations[6].meanPredictedRange).to.be.within(391, 392);
      });
  });
  it('succeeds with 4 windows', function() {
    return kit.validate(TEST_USER, { windowsCount: 4 })
      .then(({ user, validations }) => {
        expect(user.id).to.be.equal(TEST_USER.id);
        expect(validations).to.have.lengthOf(4);
        expect(validations[0]).to.be.deep.equal({
          count: 337,
          from: 1503696600,
          meanPredictedRange: 392.32648061721073,
          overestimated: 0.10385756676557864,
          to: 1504301400,
          underestimated: 0.16023738872403562,
          unknown: 0,
          valid: 0.7359050445103857
        });
        expect(validations[3]).to.be.deep.equal({
          count: 289,
          from: 1505511000,
          meanPredictedRange: 391.28417869824662,
          overestimated: 0.15570934256055363,
          to: 1506115800,
          underestimated: 0.08996539792387544,
          unknown: 0.01384083044982699,
          valid: 0.740484429065744
        });
        expect(validations[0].valid).to.be.within(0.73, 0.74);
        expect(validations[0].meanPredictedRange).to.be.within(392, 393);
        expect(validations[1].valid).to.be.within(0.82, 0.83);
        expect(validations[1].meanPredictedRange).to.be.within(388, 389);
        expect(validations[2].valid).to.be.within(0.75, 0.76);
        expect(validations[2].meanPredictedRange).to.be.within(293, 294);
        expect(validations[3].valid).to.be.within(0.74, 0.75);
        expect(validations[3].meanPredictedRange).to.be.within(391, 392);
      });
  });
  it('succeeds with a specified window size', function() {
    return kit.validate(TEST_USER, { window: 3600 * 24 * 5 })
      .then(({ user, validations }) => {
        expect(user.id).to.be.equal(TEST_USER.id);
        expect(validations).to.have.lengthOf(10);
        expect(validations[0]).to.be.deep.equal({
          count: 241,
          from: 1501795800,
          meanPredictedRange: 166.26603590041492,
          overestimated: 0.44398340248962653,
          to: 1502227800,
          underestimated: 0.14107883817427386,
          unknown: 0,
          valid: 0.4149377593360996
        });
        expect(validations[9]).to.be.deep.equal({
          count: 193,
          from: 1505683800,
          meanPredictedRange: 383.6880330932642,
          overestimated: 0.15025906735751296,
          to: 1506115800,
          underestimated: 0.046632124352331605,
          unknown: 0,
          valid: 0.8031088082901554
        });
        expect(validations[0].valid).to.be.within(0.41, 0.42);
        expect(validations[0].meanPredictedRange).to.be.within(166, 167);
        expect(validations[1].valid).to.be.within(0.70, 0.71);
        expect(validations[1].meanPredictedRange).to.be.within(374, 375);
        expect(validations[2].valid).to.be.within(0.74, 0.75);
        expect(validations[2].meanPredictedRange).to.be.within(352, 353);
        expect(validations[3].valid).to.be.within(0.75, 0.76);
        expect(validations[3].meanPredictedRange).to.be.within(395, 396);
        expect(validations[4].valid).to.be.within(0.65, 0.66);
        expect(validations[4].meanPredictedRange).to.be.within(397, 398);
        expect(validations[5].valid).to.be.within(0.78, 0.79);
        expect(validations[5].meanPredictedRange).to.be.within(369, 370);
        expect(validations[6].valid).to.be.within(0.84, 0.85);
        expect(validations[6].meanPredictedRange).to.be.within(403, 404);
        expect(validations[7].valid).to.be.within(0.63, 0.64);
        expect(validations[7].meanPredictedRange).to.be.within(297, 298);
        expect(validations[8].valid).to.be.within(0.73, 0.74);
        expect(validations[8].meanPredictedRange).to.be.within(318, 319);
        expect(validations[9].valid).to.be.within(0.80, 0.81);
        expect(validations[9].meanPredictedRange).to.be.within(383, 384);
      });
  });
});
