const { createDefaultWeatherCache } = require('../src/defaultCaches');
const Debug = require('debug');
const dotenv = require('dotenv');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

dotenv.load();
Debug.enable(process.env.DEBUG);

chai.use(chaiAsPromised);

global.expect = chai.expect;
global.debug = Debug('craft-ai:kit-energy:unit-test');
global.weatherCache = createDefaultWeatherCache();
global.RUN_ID = process.env.TRAVIS_JOB_ID || 'local';
