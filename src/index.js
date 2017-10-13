const _ = require('lodash');
const { createClient, decide, Time } = require('craft-ai');
const createGeolocationClient = require('./geolocation');
const createHolidays = require('./holidays');
const createWeatherClient = require('./weather');
const fetch = require('node-fetch');
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
    cloudCover: {
      type: 'continuous'
    },
    pressure: {
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
    weather: createWeatherClient({
      cache: weatherCache,
      darkSkySecretKey: darkSkySecretKey
    }),
    geolocation: createGeolocationClient(),
    holidays: createHolidays()
  };

  return {
    cfg: {
      token: clients.craftai.cfg.token,
      weatherCache: clients.weather.cache,
      darkSkySecretKey: clients.weather.darkSkySecretKey
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
    update: (user = {}, data = [], computeWeather = true) => {
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
          if (!computeWeather) {
            if (_.isUndefined(dataPoint.tempMin)) {
              throw new Error(`Invalid data provided for user ${user.id}: missing property 'tempMin' although the weather is not set to be computed`);
            }
            if (_.isUndefined(dataPoint.tempMax)) {
              throw new Error(`Invalid data provided for user ${user.id}: missing property 'tempMax' although the weather is not set to be computed`);
            }
            if (_.isUndefined(dataPoint.tempMean)) {
              throw new Error(`Invalid data provided for user ${user.id}: missing property 'tempMean' although the weather is not set to be computed`);
            }
          }
          return enrichedDataPromise
            .then((enrichedData) => {
              const time = Time(dataPoint.date);
              const timezone = computeTimezone(time.timestamp);
              const weatherPromise = computeWeather ? clients.weather.computeDailyWeather({
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
                      tempMax: weather.temperatureMax,
                      cloudCover: weather.cloudCover,
                      pressure: weather.pressure
                    };
                  }
                  else {
                    return {
                      holiday: holiday ? 'YES' : 'NO',
                      tempMin: dataPoint.tempMin,
                      tempMax: dataPoint.tempMax,
                      tempMean: dataPoint.tempMean
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
    computeAnomalies: ({ id }, cfg) => {
      debug(`Computing anomalies for user ${id}`);
      const { from, minStep = TIME_QUANTUM, to } = cfg;
      // 1 - Retrieve the agent
      return retrieveAgent(clients.craftai, { id })
      // 1 - Let's retrieve the decision tree at 'from' and the operations between
        .then(({ agentId }) => {
          function treeGetOperation() { return clients.craftai.getAgentDecisionTree(agentId, from); }
          debug(`Getting consumption decision tree for user ${id}`);
          return keepTryingIfTimeout(treeGetOperation, TIME_TO_RETRY_AFTER_TREE_TIMEOUT_MS, 2)
            .then((tree) => {
              const requestNextSamplePages = (samples, nextPageUrl) => {
                if (!nextPageUrl) {
                  return Promise.resolve(samples);
                }
                return fetch(nextPageUrl, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${clients.craftai.cfg.token}`,
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': 'application/json'
                  }
                })
                  .catch((err) => {
                    throw new Error(`Network error when calling ${nextPageUrl}: ${err.message}`);
                  })
                  .then((res) => {
                    if (res.status >= 400) {
                      return res.json()
                        .catch((err) => {
                          throw new Error(`Error ${res.status} when calling ${nextPageUrl}, invalid json returned: ${err}`);
                        })
                        .then((json) => {
                          throw new Error(`Error ${res.status} when calling ${nextPageUrl}: ${json.message}`);
                        });
                    }
                    else {
                      return res.json();
                    }
                  })
                  .then((body) => {
                    const newSamples = samples.concat(body.samples);
                    const nextStart = body.next;
                    if (_.isUndefined(nextStart)) {
                      return newSamples;
                    }
                    else {
                      const nextPageUrl = `${clients.craftai.cfg.url}/api/private/${clients.craftai.cfg.owner}/${clients.craftai.cfg.project}/samples/agents/${agentId}?t=${to}&start=${nextStart}`;
                      return requestNextSamplePages(newSamples, nextPageUrl);
                    }
                  });
              };
              const firstPageUrl = `${clients.craftai.cfg.url}/api/private/${clients.craftai.cfg.owner}/${clients.craftai.cfg.project}/samples/agents/${agentId}?t=${to}&start=${from}`;
              return requestNextSamplePages([], firstPageUrl)
                .then((samples) => {
                  // Don't keep everything
                  const { keptSamples } = _.reduce(samples, ({ keptSamples, previousKeptTimestamp }, operation) => {
                    if (operation.timestamp >= previousKeptTimestamp + minStep) {
                      keptSamples.push(operation);
                      return { keptSamples, previousKeptTimestamp: operation.timestamp };
                    }
                    else {
                      return { keptSamples, previousKeptTimestamp };
                    }
                  }, { keptSamples: [], previousKeptTimestamp: -minStep - 1 });
                  return keptSamples;
                })
                .then((samples) => {
                  debug(`Looking for anomalies for ${samples.length} steps between ${from} and ${to} for user ${id}`);
                  return _.map(samples, (sample) => {
                    const decision = decide(tree, sample.sample);
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
