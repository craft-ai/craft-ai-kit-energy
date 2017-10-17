const _ = require('lodash');
const { createClient, interpreter, Time } = require('craft-ai');
const createGeolocationClient = require('./geolocation');
const createHolidays = require('./holidays');
const createWeatherClient = require('./weather');
const moment = require('moment-timezone');

const debug = require('debug')('craft-ai:kit-load');

const TIME_QUANTUM = 30 * 60; // 30 minutes
const SIGMA_FACTOR_THRESHOLD = 2;
const CONFIDENCE_THRESHOLD = 0.4;
const TIME_TO_RETRY_AFTER_TREE_TIMEOUT_MS = 10000;

function computeTimezone(timestamp){
  return moment.tz(timestamp, 'Europe/Paris').format('Z');
}

const AGENT_CONFIGURATION = {
  context: {
    time: {
      type: 'time_of_day'
    },
    day: {
      type: 'day_of_week'
    },
    month: {
      type: 'month_of_year'
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

function retrieveAgent(craftaiClient, { id }) {
  if (!id) {
    return Promise.reject(new Error('No given user id.'));
  }
  return craftaiClient.getAgent(`energy-${_.kebabCase(id)}`)
    .then((agent) => ({
      id,
      agentId: agent.id,
      lastTimestamp: agent.lastTimestamp
    }));
}

function retrieveOrCreateAgent(craftaiClient, { id }) {
  return retrieveAgent(craftaiClient, { id })
    .catch(() => {
      debug(`Unable to retrieve the energy agent for '${id}', creating it...`);
      return craftaiClient
        .createAgent(AGENT_CONFIGURATION, `energy-${_.kebabCase(id)}`)
        .then((agent) => ({
          id,
          agentId: agent.id,
          lastTimestamp: undefined
        }));
    });
}

function keepTryingIfTimeout(operation, timeBetweenTriesMs, retriesLeft) {
  if (retriesLeft <= 1) {
    return operation();
  }
  return operation()
    .catch((error) => {
      if (error.status == 504 || error.status == 202) {
      // Try again in a bit
        debug(`Operation timed out, trying again in ${timeBetweenTriesMs}ms`);
        return new Promise((resolve) => setTimeout(resolve, timeBetweenTriesMs))
          .then(() => keepTryingIfTimeout(operation, TIME_TO_RETRY_AFTER_TREE_TIMEOUT_MS, retriesLeft - 1));
      }
      else {
        return Promise.reject(error);
      }
    });
}

function createKit({ darkSkySecretKey, token, weatherCache } = {}) {
  const clients = {
    craftai: createClient(token),
    weather: darkSkySecretKey && createWeatherClient({
      cache: weatherCache,
      darkSkySecretKey: darkSkySecretKey
    }),
    geolocation: createGeolocationClient(),
    holidays: createHolidays()
  };

  return {
    cfg: {
      token: clients.craftai.cfg.token,
      weatherCache: clients.weather && clients.weather.cache,
      darkSkySecretKey: clients.weather && clients.weather.darkSkySecretKey
    },
    clients,
    terminate: () => {
      // Nothing to do for now
      return Promise.resolve();
    },
    getLastDataTimestamp: (user) => {
      return retrieveAgent(clients.craftai, user)
        .then(({ lastTimestamp }) => lastTimestamp);
    },
    delete: (user) => {
      debug(`Deleting user ${user.id} if it exists`);
      return retrieveAgent(clients.craftai, user)
        .then(
          ({ agentId }) => clients.craftai.deleteAgent(agentId).then(() => user),
          // Ignoring `retrieveAgent` errors, if we can't retrieve it, it means it no longer exists.
          () => user
        );
    },
    update: (user = {}, data = []) => {
      debug(`Enriching data for user ${user.id}`);
      // 1 - Let's retrieve the matching craft ai agent and the location
      const agentPromise = retrieveOrCreateAgent(clients.craftai, user);
      const locationPromise = clients.geolocation.locate(user.location);
      // Not a Promise.all() here, because we want to wait for the stateful agent creation in every cases.
      return agentPromise.then((user) => locationPromise.then((location) => [user, location]))
        .then(([{ agentId, id, lastTimestamp }, location]) => _.reduce(data, (enrichedDataPromise, dataPoint) => {
          if (_.isUndefined(dataPoint.date)) {
            throw new Error(`Invalid data provided for user ${user.id}: missing property 'date'`);
          }
          if (_.isUndefined(dataPoint.load)) {
            throw new Error(`Invalid data provided for user ${user.id}: missing property 'load'`);
          }
          return enrichedDataPromise
            .then((enrichedData) => {
              const time = Time(dataPoint.date);
              const timezone = computeTimezone(time.timestamp);
              const weatherPromise = clients.weather ? clients.weather.computeDailyWeather({
                lat: location.lat,
                lon: location.lon,
                timestamp: time.timestamp,
                timezone: timezone
              })
                : Promise.resolve(undefined);
              return Promise.all([
                weatherPromise,
                clients.holidays.isHoliday(time.timestamp, location.postalCode)
              ])
                .then(([weather, holiday]) => {
                  if (!_.isUndefined(weather)) {
                    return {
                      holiday: holiday ? 'YES' : 'NO',
                      tempMin: weather.temperatureMin,
                      tempMax: weather.temperatureMax
                    };
                  }
                  else {
                    return {
                      holiday: holiday ? 'YES' : 'NO',
                      tempMin: dataPoint.tempMin,
                      tempMax: dataPoint.tempMax
                    };
                  }
                })
                .then((enrichedContext) => {
                  enrichedData.push(_.merge(
                    { context: enrichedContext },
                    {
                      timestamp: time.timestamp,
                      context: {
                        timezone,
                        load: dataPoint.load
                      }
                    }
                  ));
                  return enrichedData;
                });
            });
        }, Promise.resolve([]))
        // 3 - And now we can add the context operations to the craft ai agent.
          .then((contextOperations) => {
            debug(`Posting enriched data to agent for user ${user.id}`);
            return clients.craftai.addAgentContextOperations(agentId, contextOperations)
              .then(() => ({
                id,
                agentId,
                location,
                lastTimestamp: contextOperations.length ? _.last(contextOperations).timestamp : lastTimestamp
              }));
          })
        );
    },
    computeAnomalies: ({ id } = {}, { from, minStep = TIME_QUANTUM, to } = {}) => {
      debug(`Computing anomalies for user ${id}`);
      if (_.isUndefined(from) || _.isUndefined(to)) {
        return Promise.reject(new Error('`cfg.from` and `cfg.to` are needed.'));
      }

      return retrieveAgent(clients.craftai, { id })
        .then(({ agentId }) => {
          function treeGetOperation() { return clients.craftai.getAgentDecisionTree(agentId, from); }
          debug(`Getting consumption decision tree for user ${id}`);
          return Promise.all([
            keepTryingIfTimeout(treeGetOperation, TIME_TO_RETRY_AFTER_TREE_TIMEOUT_MS, 2),
            clients.craftai.getAgentStateHistory(agentId, from, to)
          ])
            .then(([tree, samples]) => {
              debug(`Looking for anomalies for ${samples.length} steps between ${from} and ${to} for user ${id}`);
              return _.map(samples, (sample) => {
                const decision = interpreter.decide(tree, sample.sample);
                return {
                  from: sample.timestamp,
                  to: sample.timestamp + minStep - 1,
                  actualLoad: sample.sample.load,
                  expectedLoad: decision.output.load.predicted_value,
                  standard_deviation: decision.output.load.standard_deviation,
                  confidence: decision.output.load.confidence,
                  decision_rules: decision.output.load.decision_rules
                };
              });
            })
            .then((potentialAnomalies) => {
              const detectedAnomalies = _.filter(potentialAnomalies, (a) =>
                (a.confidence > CONFIDENCE_THRESHOLD) &&
            (Math.abs(a.actualLoad - a.expectedLoad) > SIGMA_FACTOR_THRESHOLD * a.standard_deviation));
              debug(`Identified ${detectedAnomalies.length} anomalies for user ${id}, or ${Math.round((detectedAnomalies.length / potentialAnomalies.length) * 100)}% of considered data`);
              return { anomalies: detectedAnomalies, anomalyRatio: (detectedAnomalies.length / potentialAnomalies.length) };
            });
        });
    }
  };
}

module.exports = createKit;
