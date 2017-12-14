const _ = require('lodash');
const { AGENT_CONFIGURATION, retrieveOrCreateAgent } = require('./agent');
const { Time } = require('craft-ai');
const buffer = require('most-buffer');
const moment = require('moment-timezone');
const most = require('most');

const debug = require('debug')('craft-ai:kit-energy');
const debugOnce = _.memoize(debug);

const NON_GENERATED_PROPERTIES = _(AGENT_CONFIGURATION.context)
  .keys()
  .filter((property) => !AGENT_CONFIGURATION.context[property].is_generated)
  .value();

function computeTimezone(timestamp){
  return moment.tz(timestamp, 'Europe/Paris').format('Z');
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

function skipPartialOperations() {
  return (stream) => {
    let counter = 0;
    return stream
      .skipWhile(
        (operation) => {
          if (_.difference(NON_GENERATED_PROPERTIES, _.keys(operation.context)).length > 0) {
            ++counter;
            return true;
          }
          return false;
        }
      )
      .continueWith(() => {
      // End of the stream reached
        if (counter > 0) {
          debug(`${counter} initial data points were skipped because a complete state wasn't reached`);
        }
        return most.empty();
      });
  };
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
  const postalCode = user.location.postalCode;
  return (operation) => most.fromPromise(
    client.isHoliday(operation.timestamp, { postalCode })
      .then((holiday) => Object.assign({}, operation, {
        context: Object.assign({}, operation.context, {
          holiday: holiday ? 'YES' : 'NO'
        })
      }))
      .catch(() => {
        debugOnce(`Unable to retrieve holidays for client at postal code '${postalCode}'.`);
        return Object.assign({}, operation, {
          context: Object.assign({}, operation.context, {
            holiday: 'UNKNOWN'
          })
        });
      }));
}

function update({ clients }, user = {}, data = []) {
  debug(`Enriching data for user ${user.id}`);
  // 1 - Let's retrieve the matching craft ai agent and the location
  const agentPromise = retrieveOrCreateAgent({ clients }, user);
  const locationPromise = clients.geolocation.locate(user.location);
  let count = 0;
  // Not a Promise.all() here, because we want to wait for the stateful agent creation in every cases.
  return agentPromise.then((user) => locationPromise.then((location) => [user, location]))
    .then(([{ agentId, id, firstTimestamp, lastTimestamp }, location]) => {
      user = Object.assign(user, {
        location: Object.assign(user.location, location)
      });
      return most
        .from(data)
        .map(operationFromDatapoint(user))
        .filter(isNewOperation(lastTimestamp))
        .concatMap(clients.weather ? enrichWithWeather(clients.weather, user) : most.of)
        .concatMap(enrichWithHolidays(clients.holidays, user))
        .thru(lastTimestamp ? (stream) => stream : skipPartialOperations())
        .tap(() => count++)
        .thru(buffer(clients.craftai.cfg.operationsChunksSize))
        .filter((operationsChunk) => operationsChunk.length > 0)
        .concatMap((operationsChunk) => {
          return most.fromPromise(clients.craftai.addAgentContextOperations(agentId, operationsChunk)
            .then(() => ({
              firstTimestamp: _.first(operationsChunk).timestamp,
              lastTimestamp: _.last(operationsChunk).timestamp
            })));
        })
        // The last computed user data structure is the right one
        .reduce(
          (user, { firstTimestamp, lastTimestamp }) => Object.assign(user, ({
            firstTimestamp: user.firstTimestamp ? Math.min(user.firstTimestamp, firstTimestamp) : firstTimestamp,
            lastTimestamp: lastTimestamp,
          })),
          {
            id,
            agentId,
            location,
            firstTimestamp,
            lastTimestamp
          }
        );
    })
    .then((user) => {
      debug(`${count} data points successfully posted for user '${user.id}'.`);
      return user;
    });
}

module.exports = { update };
