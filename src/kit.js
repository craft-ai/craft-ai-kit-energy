const craftaiErrors = require('craft-ai/lib/errors');
const uuid = require('uuid/v5');

const Constants = require('./constants');
const Endpoint = require('./endpoint');


async function loadEndpoint(definition) {
  if (definition === null || typeof definition !== 'object')
    throw new TypeError(`The endpoint's definition must be an "object". Received "${definition === null ? 'null' : typeof definition}".`);
  if (typeof definition.id !== 'string')
    throw new TypeError(`The "id" property of the endpoint's definition must be a "string". Received "${definition.id === null ? 'null' : typeof definition.id}".`);

  const namespace = this.configuration.namespace;
  const agentId = definition.agentId || (namespace ? uuid(definition.id, namespace) : definition.id);

  return retrieveAgent(this.client, agentId, definition.learning).then((agent) => {
    const context = agent.configuration.context;
    const contextKeys = Object.keys(context);
    const features = contextKeys.filter((feature) => !context[feature].is_generated);
    const generated = contextKeys.filter((feature) => context[feature].is_generated);

    return Object.create(Endpoint, {
      agent: { configurable: true, value: agent },
      definition: { value: definition },
      features: { value: features },
      generated: { value: generated },
      kit: { value: this },
      agentId: { value: agentId, enumerable: true },
    });
  });
}

async function close(configuration) { /* Does nothing at the moment. */ }


async function retrieveAgent(client, agentId, learning = {}) {
  if (learning === null || typeof learning !== 'object')
    throw new TypeError(`The "learning" property of the endpoint's definition must be an "object". Received "${learning === null ? 'null' : typeof learning}".`);
  if (learning.maxRecords !== undefined && typeof learning.maxRecords !== 'number')
    throw new TypeError(`The "maxRecords" property of the endpoint's learning definition must be a "number". Received "${learning.maxRecords === null ? 'null' : typeof learning.maxRecords}".`);
  if (learning.maxRecordAge !== undefined && typeof learning.maxRecordAge !== 'number')
    throw new TypeError(`The "maxRecordAge" property of the endpoint's learning definition must be a "number". Received "${learning.maxRecordAge === null ? 'null' : typeof learning.maxRecordAge}".`);

  // TODO: proper debug
  console.log(`${'-'.repeat(10)} retrieving agent "${agentId}".`);

  return client
    .getAgent(agentId)
    // TODO: Check the configuration of the retrieved agent
    .catch((error) => {
      /* istanbul ignore else */
      if (error instanceof craftaiErrors.CraftAiBadRequestError && error.message.includes('[NotFound]'))
        return createAgent(client, agentId, learning);

      /* istanbul ignore next */
      // TODO: proper error handling
      throw error;
    });
}

async function createAgent(client, agentId, learning) {
  // TODO: proper debug
  console.log(`${'-'.repeat(10)} creating agent "${agentId}".`);

  return client
    .createAgent({
      context: {
        time: { type: 'time_of_day' },
        day: { type: 'day_of_week' },
        month: { type: 'month_of_year' },
        [TIMEZONE]: { type: 'timezone' },
        [LOAD]: { type: 'continuous' }
      },
      output: ['load'],
      operations_as_events: true,
      tree_max_depth: 6,
      tree_max_operations: learning && learning.maxRecords || 50000,
      learning_period: learning && learning.maxRecordAge || 365 * 24 * 60 * 60
    }, agentId)
    .then((agent) => {
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


const TIMEZONE = Constants.TIMEZONE_FEATURE;
const LOAD = Constants.LOAD_FEATURE;


module.exports = {
  loadEndpoint,
  close,
};
