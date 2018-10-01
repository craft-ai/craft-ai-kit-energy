const craftaiErrors = require('craft-ai/lib/errors');
const debug = require('debug');
const luxon = require('luxon');
const uuid = require('uuid/v5');

const Constants = require('./constants');
const Endpoint = require('./endpoint');
const Provider = require('./provider');


async function loadEndpoint(definition, resetAgent = false) {
  if (definition === null || typeof definition !== 'object')
    throw new TypeError(`The endpoint's definition must be an "object". Received "${definition === null ? 'null' : typeof definition}".`);

  const id = definition.id;
  const log = debug(`${DEBUG_PREFIX}:endpoint:${id}`);

  log('loading');

  if (typeof id !== 'string')
    throw new TypeError(`The "id" property of the endpoint's definition must be a "string". Received "${id === null ? 'null' : typeof id}".`);

  const metadata = definition.metadata;

  if (metadata !== undefined && (metadata === null || typeof metadata !== 'object'))
    throw new TypeError(`The "metadata" property of the endpoint's definition must be an "object". Received "${metadata === null ? 'null' : typeof metadata}"`);

  const energy = parseEnergyArgument(definition.energy);
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
        metadata: { value: metadata || {}, enumerable: true },
      });
    });
}

async function close() {
  return Provider
    .close(this.configuration.providers)
    .then(() => this.debug('closed'));
}


async function generateAgentConfiguration(log, providers, learning = {}) {
  log('generating the agent\'s configuration');

  if (learning === null || typeof learning !== 'object')
    throw new TypeError(`The "learning" property of the endpoint's definition must be an "object". Received "${learning === null ? 'null' : typeof learning}".`);

  const maxRecords = learning.maxRecords;

  if (maxRecords !== undefined && typeof maxRecords !== 'number')
    throw new TypeError(`The "maxRecords" property of the endpoint's learning definition must be a "number". Received "${maxRecords === null ? 'null' : typeof maxRecords}".`);

  const maxRecordAge = learning.maxRecordAge;

  if (maxRecordAge !== undefined && typeof maxRecordAge !== 'number')
    throw new TypeError(`The "maxRecordAge" property of the endpoint's learning definition must be a "number". Received "${maxRecordAge === null ? 'null' : typeof maxRecordAge}".`);

  const properties = learning.properties;

  if (properties !== undefined && (properties === null || typeof properties !== 'object'))
    throw new TypeError(`The "properties" property of the endpoint's learning definition must be an "object". Received "${properties === null ? 'null' : typeof properties}".`);
  
  const tree_max_depth = learning.tree_max_depth;

  if (tree_max_depth !== undefined && (tree_max_depth === null || typeof tree_max_depth !== 'number'))
    throw new TypeError(`The "tree_max_depth" property of the endpoint's learning definition must be a number. Received "${tree_max_depth === null ? 'null' : typeof tree_max_depth}".`);
  
  const time_quantum = learning.time_quantum;

  if (time_quantum !== undefined && (time_quantum === null || typeof time_quantum !== 'number'))
    throw new TypeError(`The "time_quantum" property of the endpoint's learning definition must be a number. Received "${time_quantum === null ? 'null' : typeof time_quantum}".`);

  return Provider
    .extendConfiguration(providers, {
      time: { type: 'time_of_day' },
      day: { type: 'day_of_week' },
      month: { type: 'month_of_year' },
      ...properties,
      [TIMEZONE]: { type: 'timezone' },
      [LOAD]: { type: 'continuous' }
    })
    .then((context) => ({
      context,
      output: ['load'],
      operations_as_events: true,
      tree_max_depth: tree_max_depth || 4,
      tree_max_operations: maxRecords || 50000,
      learning_period: maxRecordAge || 365 * 24 * 60 * 60,
      time_quantum: time_quantum || 10*60
    }));
}

async function retrieveAgent(log, client, agentId, agentConfiguration, resetAgent) {
  if (resetAgent) {
    /* istanbul ignore if */
    if (process.env.NODE_ENV === 'production')
      console.warn('WARNING: The endpoint\'s agent is being forced to be resetted.');

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

async function createAgent(log, client, agentId, agentConfiguration) {
  log('creating the agent');

  return client
    .createAgent(agentConfiguration, agentId)
    .then((agent) => {
      log('the agent has been created');

      const date = Date.now();

      agent.creationDate = date;
      agent.lastTreeUpdate = date;
      agent.lastContextUpdate = date;

      return agent;
    })
    .catch(/* istanbul ignore next */(error) => {
      // TODO: proper error handling
      throw error;
    });
}

function parseEnergyArgument(value) {
  const energy = {};

  if (value === undefined) return energy;
  if (value === null || typeof value !== 'object')
    throw new TypeError(`The "energy" property of the endpoint's definition must be an "object". Received "${value === null ? 'null' : typeof value}".`);

  if (value.period !== undefined) {
    if (value.period === null || typeof value.period !== 'object')
      throw new TypeError(`The "period" property of the endpoint's energy definition must be an "object". Received "${value.period === null ? 'null' : typeof value.period}".`);

    const period = luxon.Duration.fromObject(value.period);

    if (period.valueOf() === 0)
      throw new RangeError(`The "period" property of the endpoint's energy definition must represent a strictly positive duration. Received "${value.period}".`);

    energy.period = period;
    energy.hours = period.as('hours');
  }

  if (value.origin !== undefined) {
    if (value.origin === null || typeof value.origin !== 'object')
      throw new TypeError(`The "origin" property of the endpoint's energy definition must be an "object". Received "${value.origin === null ? 'null' : typeof value.origin}".`);
    if (luxon.DateTime.fromObject(value.origin).invalidReason)
      throw new RangeError(`The "origin" property of the endpoint's energy definition must be a valid date definition. Received "${JSON.stringify(value.origin)}". Reason: ${luxon.DateTime.fromObject(value.origin).invalidReason}.`);
    if (value.period === undefined)
      throw new Error('The "origin" property of the endpoint\'s energy definition cannot be defined without a "period" property.');

    energy.origin = value.origin;
  }

  return energy;
}


const DEBUG_PREFIX = Constants.DEBUG_PREFIX;
const LOAD = Constants.LOAD_FEATURE;
const TIMEZONE = Constants.TIMEZONE_FEATURE;


module.exports = {
  loadEndpoint,
  close,
};
