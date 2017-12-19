const _ = require('lodash');
const debug = require('debug')('craft-ai:kit-energy');

const TIME_QUANTUM = 30 * 60; // 30 minutes

const AGENT_CONFIGURATION = {
  context: {
    time: {
      type: 'time_of_day',
      is_generated: true
    },
    day: {
      type: 'day_of_week',
      is_generated: true
    },
    month: {
      type: 'month_of_year',
      is_generated: true
    },
    timezone: {
      type: 'timezone'
    },
    tempMin: {
      type: 'continuous'
    },
    tempMax: {
      type: 'continuous'
    },
    load: {
      type: 'continuous'
    },
    holiday: {
      type: 'enum'
    }
  },
  output: [
    'load'
  ],
  operations_as_events: true,
  time_quantum: TIME_QUANTUM,
  learning_period: 365 * 24 * 60 * 60, // One year
  tree_max_operations: 50000,
  tree_max_depth: 6
};

function getEnergyAgentId({ agentId, id }) {
  return agentId || `energy-${_.kebabCase(id)}`;
}

function retrieveAgent({ clients }, user) {
  if (!user.id) {
    return Promise.reject(new Error('No given user id.'));
  }
  return clients.craftai.getAgent(getEnergyAgentId(user))
    .then((agent) => ({
      id: user.id,
      agentId: agent.id,
      firstTimestamp: agent.firstTimestamp,
      lastTimestamp: agent.lastTimestamp
    }));
}

function retrieveOrCreateAgent({ clients }, user) {
  return retrieveAgent({ clients }, user)
    .catch(() => {
      debug(`Unable to retrieve the energy agent for '${user.id}', creating it...`);
      return clients.craftai
        .createAgent(AGENT_CONFIGURATION, getEnergyAgentId(user))
        .then((agent) => ({
          id: user.id,
          agentId: agent.id,
          firstTimestamp: undefined,
          lastTimestamp: undefined
        }));
    });
}

module.exports = { AGENT_CONFIGURATION, retrieveAgent, retrieveOrCreateAgent };
