const craftaiErrors = require('craft-ai/lib/errors');
const debug = require('debug');
const uuid = require('uuid/v5');

const Constants = require('./constants');
const Endpoint = require('./endpoint');
const Provider = require('./provider');
const Utils = require('./utils');

const DEBUG_PREFIX = Constants.DEBUG_PREFIX;
const LOAD = Constants.LOAD_FEATURE;
const TIMEZONE = Constants.TIMEZONE_FEATURE;

/**
 * @typedef Energy
 * @type {object}
 * @property {Number} period positive number (in seconds)
 * @property {Number} hours positive numver
 * @property {String} origin date which is the origin.
 * @property {Provider} providers
 */

/**
 * @typedef Endpoint
 * @type {object}
 * @property {String} id name of the endpoint
 * @property {Energy} [energy] [OPTIONAL] energy configuration
 * @property {Object} [metadata] [OPTIONAL]
 * @property {String} [agentId] [OPTIONAL] identifiant of the craft ai agent, Default is id.
 * @property {String} [agent] [OPTIONAL]
 * @property {Object} [learning] [OPTIONAL] as described in generateAgentConfiguration
 * @property {Object} [kit] [OPTIONAL]
 * @property {Object} [feature] [OPTIONAL]
 * @property {Object} generated
 */

/**
 * Get the craft ai agent endpoint
 *
 * @param {Endpoint} definition
 * @param {boolean} [resetAgent=false] [OPTIONAL], if true the agent is deleted and (re-)created
 *
 * @returns {Object} An object endpoint
 */
async function loadEndpoint(definition, resetAgent = false) {
  if (definition === null || typeof definition !== 'object') {
    throw new TypeError(`The endpoint's definition must be an "object". Received "${definition === null ? 'null' : typeof definition}".`);
  }

  const id = definition.id;
  const log = debug(`${DEBUG_PREFIX}:endpoint:${id}`);

  log('loading');

  if (typeof id !== 'string') {
    throw new TypeError(`The "id" property of the endpoint's definition must be a "string". Received "${id === null ? 'null' : typeof id}".`);
  }

  const metadata = definition.metadata;

  if (metadata !== undefined) {
    if (metadata === null || typeof metadata !== 'object') {
      throw new TypeError(`The "metadata" property of the endpoint's definition must be an "object". Received "${metadata === null ? 'null' : typeof metadata}"`);
    }

    const zone = metadata.zone;

    if (zone === undefined) {
      metadata.zone = this.configuration.zone;
    }
    else {
      if (Utils.isNotString(zone)) {
        throw new TypeError(`The "zone" property of the endpoint's configuration must be a "string". Received "${typeof zone}".`);
      }
      if (!Utils.checkZone(zone)) {
        throw new RangeError('The "zone" property of the endpoint\'s configuration must be a valid IANA zone or a fixed-offset name.');
      }
    }
  }

  const energy = parseEnergyConfiguration(definition.energy);
  const namespace = this.configuration.namespace;
  const agentId = definition.agentId || (namespace ? uuid(id, namespace) : id);

  return generateAgentConfiguration(log, this.configuration.providers, definition.learning)
    .then((agentConfiguration) => retrieveAgent(log, this.client, agentId, agentConfiguration, resetAgent))
    .then((agent) => {
      const context = agent.configuration.context;
      const contextKeys = Object.keys(context);
      const features = contextKeys.filter((feature) => !context[feature].is_generated);
      const generated = contextKeys.filter((feature) => context[feature].is_generated);

      log('loaded');

      return Object.create(Endpoint, {
        agent: { value: agent, configurable: true },
        debug: { value: log },
        energy: { value: energy },
        features: { value: features },
        generated: { value: generated },
        kit: { value: this },
        agentId: { value: agentId, enumerable: true },
        id: { value: id, enumerable: true },
        metadata: { value: metadata || { zone: this.configuration.zone }, enumerable: true }
      });
    });
}

/**
 * Close the kit and all of its providers
 */
async function close() {
  return Provider
    .close(this.configuration.providers)
    .then(() => this.debug('closed'));
}

/**
 * Generate a craft ai agent configuration
 *
 * @param {String} log
 * @param {Array<Provider>} providers Array of providers that have as function extendConfiguration
 * @param {Object} [learning={}] [OPTIONAL] Object that contains parameters of the configuration. Can contain:
 *  - maxTreeDepth: positive integer, define the max depth of the decision tree. Default is 6.
 *  - maxRecords: positive integer, maximum number of events on which a single decision tree can be based. Default is 50000.
 *  - maxRecordAge: positive integer, the maximum amount of time, in seconds, that matters for an agent. Default is one year.
 *  - properties: object, context properties to add to {time: { type: 'time_of_day' }, day: { type: 'day_of_week' },
 *    month: { type: 'month_of_year' }, timezone: { type: 'timezone' }, load: { type: 'continuous' }}
 *  - advancedConfiguration: Object, advanced configuration options. Default is {}
 * @returns {Object} craft ai agent configuration
 */
async function generateAgentConfiguration(log, providers, learning = {}) {
  log('generating the agent\'s configuration');

  if (learning === null || typeof learning !== 'object') {
    throw new TypeError(`The "learning" property of the endpoint's definition must be an "object". Received "${ learning === null ? 'null' : typeof learning }".`);
  }

  const maxTreeDepth = learning.maxTreeDepth;
  if (maxTreeDepth !== undefined && typeof maxTreeDepth !== 'number') {
    throw new TypeError(`The "maxTreeDepth" property of the endpoint's learning definition must be a "number". Received "${maxTreeDepth === null ? 'null' : typeof maxTreeDepth}".`);
  }

  const maxRecords = learning.maxRecords;

  if (maxRecords !== undefined && typeof maxRecords !== 'number') {
    throw new TypeError(`The "maxRecords" property of the endpoint's learning definition must be a "number". Received "${maxRecords === null ? 'null' : typeof maxRecords}".`);
  }

  const maxRecordAge = learning.maxRecordAge;

  if (maxRecordAge !== undefined && typeof maxRecordAge !== 'number') {
    throw new TypeError(`The "maxRecordAge" property of the endpoint's learning definition must be a "number". Received "${maxRecordAge === null ? 'null' : typeof maxRecordAge}".`);
  }

  const properties = learning.properties;

  if (properties !== undefined && (properties === null || typeof properties !== 'object')) {
    throw new TypeError(`The "properties" property of the endpoint's learning definition must be an "object". Received "${properties === null ? 'null' : typeof properties}".`);
  }

  const advancedConfiguration = learning.advancedConfiguration;

  if (advancedConfiguration !== undefined && (advancedConfiguration === null || typeof advancedConfiguration !== 'object')) {
    throw new TypeError(`The "options" property of the endpoint's learning definition must be an "object". Received "${advancedConfiguration === null ? 'null' : typeof advancedConfiguration}".`);
  }

  return Provider.extendConfiguration(providers, {
    time: { type: 'time_of_day' },
    day: { type: 'day_of_week' },
    month: { type: 'month_of_year' },
    ...properties,
    [TIMEZONE]: { type: 'timezone' },
    [LOAD]: { type: 'continuous' }
  })
    .then((context) => {
      return {
        context,
        output: ['load'],
        operations_as_events: true,
        tree_max_depth: maxTreeDepth || 6,
        tree_max_operations: maxRecords || 50000,
        learning_period: maxRecordAge || 365 * 24 * 60 * 60,
        ...advancedConfiguration
      };
    });
}

/**
 * Get the craft ai agent
 *
 * @param {String} log
 * @param {Object} client craft ai client
 * @param {String} agentId id given to the agent to get
 * @param {Object} agentConfiguration craft ai agent configuration, it is needed if the agent
 *  is reseted or doesn't exist and needs to be created
 * @param {boolean} [resetAgent] [OPTIONAL] if true the agent is deleted and created
 *
 * @returns {Object} craft ai agent configuration
 */
async function retrieveAgent(log, client, agentId, agentConfiguration, resetAgent) {
  if (resetAgent) {
    /* istanbul ignore if */
    if (process.env.NODE_ENV === 'production') {
      console.warn('WARNING: The endpoint\'s agent is being forced to be resetted.');
    }

    return client
      .deleteAgent(agentId)
      .then(() => createAgent(log, client, agentId, agentConfiguration));
  }

  log('retrieving the agent "%s"', agentId);

  return client
    .getAgent(agentId)
    // TODO: Check the configuration of the retrieved agent
    .then((agent) => {
      log('the agent has been retrieved');

      return agent;
    })
    .catch((error) => {
      /* istanbul ignore else */
      if (error instanceof craftaiErrors.CraftAiBadRequestError && error.message.includes('[NotFound]')) {
        log('the agent does not exist');

        return createAgent(log, client, agentId, agentConfiguration);
      }

      /* istanbul ignore next */
      // TODO: proper error handling
      throw error;
    });
}

/**
 * Create a craft ai agent
 *
 * @param {String} log
 * @param {Object} client craft ai client
 * @param {String} agentId id to give to the agent
 * @param {Object} agentConfiguration craft ai agent configuration
 *
 * @returns {Object} craft ai agent configuration
 */
async function createAgent(log, client, agentId, agentConfiguration) {
  log('creating the agent');

  return client
    .createAgent(agentConfiguration, agentId)
    .then(() => {
      log('the agent has been created');
      return client.getAgent(agentId);
    })
    .catch(/* istanbul ignore next */(error) => {
      // Agent has been already created during our creation so we just get the info from it
      if (error.message.includes('because one already exists.')) {
        return client.getAgent(agentId);
      }
      throw error;
    });
}

/**
 * Parse the energy configuration
 *
 * @param {Energy} energy
 *
 * @returns {{ period: Number, hours: Number, origin: String }} Contains the parsed energy configuration
 */
function parseEnergyConfiguration(energy) {
  const parsedEnergy = {};

  if (energy === undefined) {
    return energy;
  }
  if (energy === null || typeof energy !== 'object') {
    throw new TypeError(`The "energy" property of the endpoint's definition must be an "object". Received "${energy === null ? 'null' : typeof energy}".`);
  }

  if (energy.period !== undefined) {
    if (typeof energy.period !== 'number') {
      throw new TypeError(`The "period" property of the endpoint's energy definition must be an "number". Received "${typeof energy.period}".`);
    }

    if (energy.period <= 0) {
      throw new RangeError(`The "period" property of the endpoint's energy definition must represent a strictly positive duration. Received "${energy.period}".`);
    }

    parsedEnergy.period = energy.period * 1000;
    parsedEnergy.hours = energy.period / 3600;
  }

  if (energy.origin !== undefined) {
    const origin = Utils.parseDate(energy.origin);

    if (!origin.isValid) {
      throw new RangeError(`The "origin" property of the endpoint's energy definition must be a valid date definition. Received "${JSON.stringify(energy.origin)}". Reason: ${origin.invalidReason}.`);
    }

    if (energy.period === undefined) {
      throw new Error('The "origin" property of the endpoint\'s energy definition cannot be defined without a "period" property.');
    }

    parsedEnergy.origin = origin;
  }

  return parsedEnergy;
}

module.exports = {
  loadEndpoint,
  close
};
