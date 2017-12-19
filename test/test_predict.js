const createEnergyKit = require('../src');

const TEST_USER = {
  id: `test_predict_user_${RUN_ID}`,
  location: {
    postalCode: '75013'
  }
};
const TEST_USER_AGENT_ID = `energy-test-predict-user-${RUN_ID}`;
const TEST_DATA = require('./data/test_weather.data.json');

describe('predict(user, {from, to})', function() {
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
  it('fails properly when no {from, to} is provided', function() {
    return expect(kit.predict(TEST_USER, undefined)).to.be.rejected;
  });
  it('succeeds when {from} is provided', function() {
    return kit.predict(TEST_USER, {
      from: new Date('2017-09-21T12:00+02:00')
    })
      .then(({ user, predictions }) => {
        expect(user.id).to.be.equal(TEST_USER.id);
        expect(predictions).to.have.lengthOf(72);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.VALID)).to.have.lengthOf(54);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.UNKNOWN)).to.have.lengthOf(0);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.OVERESTIMATED)).to.have.lengthOf(9);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.UNDERESTIMATED)).to.have.lengthOf(9);
      });
  });
  it('succeeds when {from, to} is provided', function() {
    return kit.predict(TEST_USER, {
      from: new Date('2017-09-15T12:00+02:00'),
      to: new Date('2017-09-20T12:00+02:00')
    })
      .then(({ user, predictions }) => {
        expect(user.id).to.be.equal(TEST_USER.id);
        expect(predictions).to.have.lengthOf(217);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.VALID)).to.have.lengthOf(166);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.UNKNOWN)).to.have.lengthOf(4);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.OVERESTIMATED)).to.have.lengthOf(31);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.UNDERESTIMATED)).to.have.lengthOf(16);
      });
  });
  it('succeeds when {from, to} is provided and the kit\'s `absoluteDeviationThreshold` is updated.', function() {
    kit.cfg.absoluteDeviationThreshold = 200;

    return kit.predict(TEST_USER, {
      from: new Date('2017-09-15T12:00+02:00'),
      to: new Date('2017-09-20T12:00+02:00')
    })
      .then(({ user, predictions }) => {
        expect(user.id).to.be.equal(TEST_USER.id);
        expect(predictions).to.have.lengthOf(217);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.VALID)).to.have.lengthOf(138);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.UNKNOWN)).to.have.lengthOf(4);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.OVERESTIMATED)).to.have.lengthOf(47);
        expect(predictions.filter(({ status }) => status === kit.PREDICTION_STATUS.UNDERESTIMATED)).to.have.lengthOf(28);
      });
  });
});
