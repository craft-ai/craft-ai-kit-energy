const craftaiErrors = require('craft-ai/lib/errors');
const debug = require('debug');
const uuid = require('uuid/v5');

const Constants = require('./constants');
const Endpoint = require('./endpoint');
const Provider = require('./provider');


async function loadEndpoint(definition) {
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

  const namespace = this.configuration.namespace;
  const agentId = definition.agentId || (namespace ? uuid(id, namespace) : id);

  return generateAgentConfiguration(log, this.configuration.providers, definition.learning)
    .then((agentConfiguration) => retrieveAgent(log, this.client, agentId, agentConfiguration))
    .then((agent) => {
      const context = agent.configuration.context;
      const contextKeys = Object.keys(context);
      const features = contextKeys.filter((feature) => !context[feature].is_generated);
      const generated = contextKeys.filter((feature) => context[feature].is_generated);

      log('loaded');

      return Object.create(Endpoint, {
        agent: { value: agent, configurable: true },
        debug: { value: log },
        definition: { value: definition },
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
      tree_max_depth: 6,
      tree_max_operations: maxRecords || 50000,
      learning_period: maxRecordAge || 365 * 24 * 60 * 60
    }));
}

async function retrieveAgent(log, client, agentId, agentConfiguration) {
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


const DEBUG_PREFIX = Constants.DEBUG_PREFIX;
const LOAD = Constants.LOAD_FEATURE;
const TIMEZONE = Constants.TIMEZONE_FEATURE;


module.exports = {
  loadEndpoint,
  close,
};
