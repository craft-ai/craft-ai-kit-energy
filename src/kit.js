const craftaiErrors = require('craft-ai/lib/errors');
const debug = require('debug');
const uuid = require('uuid/v5');

const Constants = require('./constants');
const Endpoint = require('./endpoint');
const Provider = require('./provider');
const Utils = require('./utils');

async function loadEndpoint(definition, resetAgent = false) {
  /*
  Get the craft ai agent

  *************
  **Arguments**
  *************
  definition: Object that define the endpoint/craft ai agent.
    It should contains:
      - id: String, identifiant of the endpoint
    It can contains:
      - energy: Object optional, energy configuration that contains:
        - period: positive integer, duration
        - origin: String, date which is the origin.
      - metadata: Object, that contains the metadata:
        - zone: String, IANA zone
      - agentId: String, identifiant of the craft ai agent, Default is id.
  resetAgent: boolean optional, if true the agent is deleted and created

  **********
  **Return**
  **********
  An object endpoint
  */
  if (definition === null || typeof definition !== 'object')
    throw new TypeError(`The endpoint's definition must be an "object". Received "${definition === null ? 'null' : typeof definition}".`);

  const id = definition.id;
  const log = debug(`${DEBUG_PREFIX}:endpoint:${id}`);

  log('loading');

  if (typeof id !== 'string')
    throw new TypeError(`The "id" property of the endpoint's definition must be a "string". Received "${id === null ? 'null' : typeof id}".`);

  const metadata = definition.metadata;

  if (metadata !== undefined) {
    if (metadata === null || typeof metadata !== 'object')
      throw new TypeError(`The "metadata" property of the endpoint's definition must be an "object". Received "${metadata === null ? 'null' : typeof metadata}"`);

    const zone = metadata.zone;

    if (zone === undefined) metadata.zone = this.configuration.zone;
    else {
      if (Utils.isNotString(zone))
        throw new TypeError(`The "zone" property of the endpoint's configuration must be a "string". Received "${typeof zone}".`);
      if (!Utils.checkZone(zone))
        throw new RangeError('The "zone" property of the endpoint\'s configuration must be a valid IANA zone or a fixed-offset name.');
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
        metadata: { value: metadata || { zone: this.configuration.zone }, enumerable: true },
      });
    });
}

async function close() {
  /*
  Close the kit
  */
  return Provider
    .close(this.configuration.providers)
    .then(() => this.debug('closed'));
}

async function generateAgentConfiguration(log, providers, learning = {}) {
  /*
  Generate a craft ai configuration

  *************
  **Arguments**
  *************
  log: String
  providers: Array of providers that have as function extendConfiguration and extendConfigurationOption
  learning: Object optional, parameters of the configuration. Can contain:
    - maxTreeDepth: positive integer, define the max depth of the decision tree. Default is 6.
    - maxRecords: positive integer, maximum number of events on which a single decision tree can be based. Default is 50000.
    - maxRecordAge: positive integer, the maximum amount of time, in seconds, that matters for an agent. Default is one year.
    - properties: object, context properties to add to {time: { type: 'time_of_day' }, day: { type: 'day_of_week' },
    month: { type: 'month_of_year' }, timezone: { type: 'timezone' }, load: { type: 'continuous' }}
    - options: object, configuration options. Default is {}

  **********
  **Return**
  **********
  craft ai configuration
  */
  log('generating the agent\'s configuration');

  if (learning === null || typeof learning !== 'object')
    throw new TypeError(`The "learning" property of the endpoint's definition must be an "object". Received "${ learning === null ? 'null' : typeof learning }".`);

  const maxTreeDepth = learning.maxTreeDepth;
  if (maxTreeDepth !== undefined && typeof maxTreeDepth !== 'number')
    throw new TypeError(`The "maxTreeDepth" property of the endpoint's learning definition must be a "number". Received "${maxTreeDepth === null ? 'null' : typeof maxTreeDepth}".`);

  const maxRecords = learning.maxRecords;

  if (maxRecords !== undefined && typeof maxRecords !== 'number')
    throw new TypeError(`The "maxRecords" property of the endpoint's learning definition must be a "number". Received "${maxRecords === null ? 'null' : typeof maxRecords}".`);

  const maxRecordAge = learning.maxRecordAge;

  if (maxRecordAge !== undefined && typeof maxRecordAge !== 'number')
    throw new TypeError(`The "maxRecordAge" property of the endpoint's learning definition must be a "number". Received "${maxRecordAge === null ? 'null' : typeof maxRecordAge}".`);

  const properties = learning.properties;

  if (properties !== undefined && (properties === null || typeof properties !== 'object'))
    throw new TypeError(`The "properties" property of the endpoint's learning definition must be an "object". Received "${properties === null ? 'null' : typeof properties}".`);

  const options = learning.options;

  if (options !== undefined && (options === null || typeof options !== 'object'))
    throw new TypeError(`The "options" property of the endpoint's learning definition must be an "object". Received "${options === null ? 'null' : typeof options}".`);

  return Provider.extendConfiguration(providers, {
    time: { type: 'time_of_day' },
    day: { type: 'day_of_week' },
    month: { type: 'month_of_year' },
    ...properties,
    [TIMEZONE]: { type: 'timezone' },
    [LOAD]: { type: 'continuous' }
  }).then((context) => {
    return Provider
      .extendConfigurationOption(
        providers, {
          context,
          output: ['load'],
          operations_as_events: true,
          tree_max_depth: maxTreeDepth || 6,
          tree_max_operations: maxRecords || 50000,
          learning_period: maxRecordAge || 365 * 24 * 60 * 60,
          ...options
        }
      );
  });
}

async function retrieveAgent(log, client, agentId, agentConfiguration, resetAgent) {
  /*
  Get the craft ai agent

  *************
  **Arguments**
  *************
  log: String
  client: craft ai client
  agentId: String, id given to the agent to get
  agentConfiguration: Object, craft ai agent configuration, it is needed if the agent
  is reseted or doesn't exist and needs to be created
  resetAgent: boolean optional, if true the agent is deleted and created

  **********
  **Return**
  **********
  craft ai configuration
  */
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
  /*
  Create a craft ai agent

  *************
  **Arguments**
  *************
  log: String
  client: craft ai client
  agentId: String, id to give to the agent
  agentConfiguration: Object, craft ai agent configuration

  **********
  **Return**
  **********
  craft ai configuration
  */

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

function parseEnergyConfiguration(value) {
  /*
  Parse the energy configuration

  *************
  **Arguments**
  *************
  value: Object optional, it contains:
    - period: positive integer, duration
    - origin: String, date which is the origin

  **********
  **Return**
  **********
  Object that contains the parsed energy configuration
  */
  const energy = {};

  if (value === undefined) return energy;
  if (value === null || typeof value !== 'object')
    throw new TypeError(`The "energy" property of the endpoint's definition must be an "object". Received "${value === null ? 'null' : typeof value}".`);

  if (value.period !== undefined) {
    if (typeof value.period !== 'number')
      throw new TypeError(`The "period" property of the endpoint's energy definition must be an "number". Received "${typeof value.period}".`);

    if (value.period <= 0)
      throw new RangeError(`The "period" property of the endpoint's energy definition must represent a strictly positive duration. Received "${value.period}".`);

    energy.period = value.period * 1000;
    energy.hours = value.period / 3600;
  }

  if (value.origin !== undefined) {
    const origin = Utils.parseDate(value.origin);

    if (!origin.isValid)
      throw new RangeError(`The "origin" property of the endpoint's energy definition must be a valid date definition. Received "${JSON.stringify(value.origin)}". Reason: ${origin.invalidReason}.`);

    if (value.period === undefined)
      throw new Error('The "origin" property of the endpoint\'s energy definition cannot be defined without a "period" property.');

    energy.origin = origin;
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
