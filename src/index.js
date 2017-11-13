const _ = require('lodash');
const { createClient, interpreter, Time } = require('craft-ai');
const { checkConfiguration, DEFAULT_CONFIGURATION } = require('./configuration');
const { last } = require('most-nth');
const buffer = require('most-buffer');
const createGeolocationClient = require('./geolocation');
const createHolidays = require('./holidays');
const createWeatherClient = require('./weather');
const moment = require('moment-timezone');
const most = require('most');

const debug = require('debug')('craft-ai:kit-load');

const TIME_QUANTUM = 30 * 60; // 30 minutes

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

function operationFromDatapoint(user) {
  return (dataPoint) => {
    if (_.isUndefined(dataPoint.date)) {
      throw new Error(`Invalid data provided for user ${user.id}: missing property 'date'`);
    }
    if (_.isUndefined(dataPoint.load)) {
      throw new Error(`Invalid data provided for user ${user.id}: missing property 'load'`);
    }

    const time = Time(dataPoint.date);
    const timezone = computeTimezone(time.timestamp);
    return {
      timestamp: time.timestamp,
      context: Object.assign({}, _.omit(dataPoint, 'date'), { timezone })
    };
  };
}

function isNewOperation(lastTimestamp) {
  if (!lastTimestamp) {
    return () => true;
  }
  else {
    return ({ timestamp }) => timestamp > lastTimestamp;
  }
}

function enrichWithWeather(client, user) {
  return (operation) => most.fromPromise(
    client.computeDailyWeather({
      lat: user.location.lat,
      lon: user.location.lon,
      timestamp: operation.timestamp,
      timezone: operation.context.timezone
    })
      .then((weather) => Object.assign({}, operation, {
        context: Object.assign({}, operation.context, {
          tempMin: weather.temperatureMin,
          tempMax: weather.temperatureMax
        })
      })));
}

function enrichWithHolidays(client, user) {
  return (operation) => most.fromPromise(
    client.isHoliday(operation.timestamp, user.location.postalCode)
      .then((holiday) => Object.assign({}, operation, {
        context: Object.assign({}, operation.context, {
          holiday: holiday ? 'YES' : 'NO'
        })
      })));
}

function createKit(cfg = {}) {
  cfg = Object.assign({}, DEFAULT_CONFIGURATION, cfg);

  checkConfiguration(cfg);

  const { darkSkySecretKey, token, weatherCache } = cfg;
  const clients = {
    craftai: createClient(token),
    weather: darkSkySecretKey && createWeatherClient({
      cache: weatherCache,
      darkSkySecretKey: darkSkySecretKey
    }),
    geolocation: createGeolocationClient(),
    holidays: createHolidays()
  };

  cfg.weatherCache = clients.weather && clients.weather.cache;
  cfg.darkSkySecretKey = clients.weather && clients.weather.darkSkySecretKey;

  return {
    cfg: cfg,
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
        .then(([{ agentId, id, lastTimestamp }, location]) => {
          user = Object.assign(user, {
            location: Object.assign(user.location, location)
          });
          return most
            .from(data)
            .map(operationFromDatapoint(user))
            .filter(isNewOperation(lastTimestamp))
            .concatMap(clients.weather ? enrichWithWeather(clients.weather, user) : most.of)
            .concatMap(enrichWithHolidays(clients.holidays, user))
            .thru(buffer(clients.craftai.cfg.operationsChunksSize))
            .concatMap((operationsChunk) => {
              debug(`Posting enriched data to agent for user ${user.id}`);
              return most.fromPromise(clients.craftai.addAgentContextOperations(agentId, operationsChunk)
                .then(() => ({
                  id,
                  agentId,
                  location,
                  lastTimestamp: operationsChunk.length ? _.last(operationsChunk).timestamp : lastTimestamp
                })));
            })
            // The last computed user data structure is the right one
            .thru(last);
        });
    },
    computeAnomalies: ({ id } = {}, { from, minStep = TIME_QUANTUM, to } = {}) => {
      debug(`Computing anomalies for user ${id}`);
      if (_.isUndefined(from) || _.isUndefined(to)) {
        return Promise.reject(new Error('`cfg.from` and `cfg.to` are needed.'));
      }

      debug(`Getting consumption decision tree for user ${id}`);

      return retrieveAgent(clients.craftai, { id })
        .then(({ agentId }) => Promise.all([
          clients.craftai.getAgentDecisionTree(agentId, from),
          clients.craftai.getAgentStateHistory(agentId, from, to)
        ]))
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
            (a.confidence > cfg.confidenceThreshold) &&
        (Math.abs(a.actualLoad - a.expectedLoad) > cfg.sigmaFactorThreshold * a.standard_deviation));
          debug(`Identified ${detectedAnomalies.length} anomalies for user ${id}, or ${Math.round((detectedAnomalies.length / potentialAnomalies.length) * 100)}% of considered data`);
          return { anomalies: detectedAnomalies, anomalyRatio: (detectedAnomalies.length / potentialAnomalies.length) };
        });
    }
  };
}

module.exports = createKit;
