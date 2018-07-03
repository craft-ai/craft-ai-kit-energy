const buffer = require('most-buffer');
const most = require('most');

const Common = require('./common');
const Constants = require('../constants');
const Provider = require('../provider');


async function update(records) {
  this.debug('updating');

  const agent = this.agent;
  const agentId = this.agentId;
  const client = this.kit.client;
  const features = this.features;
  const end = agent.lastTimestamp;

  let failed = false;

  return Common
    .toRecordStream(records)
    // TODO: Convert index values to mean electrical loads
    // Extend the record with providers
    .thru(Provider.extendRecords.bind(null, this))
    .thru(end === undefined
      ? Common.mergeUntilFirstFullRecord.bind(null, features)
      : ignoreOldRecords.bind(null, end))
    // Send the context operations by bulks.
    .thru(Common.formatRecords.bind(null, features))
    .thru(buffer(client.cfg.operationsChunksSize))
    .recoverWith((error) => {
      // TODO: proper error handling
      failed = true;

      return most.throwError(error);
    })
    .concatMap((history) => most.fromPromise(client
      .addAgentContextOperations(agentId, history)
      .then(() => {
        this.debug('added %d records to the agent\'s history', history.length);

        return history;
      })
      .catch(/* istanbul ignore next */(error) => {
        if (!failed) throw error;
      })))
    // Update agent's local state
    .reduce((result, history) => {
      if (!result.start) result.start = history[0].timestamp;

      result.end = history[history.length - 1].timestamp;

      return result;
    }, { start: agent.start, end })
    .then((result) => {
      agent.firstTimestamp = result.start;
      agent.lastTimestamp = result.end;
      agent.lastContextUpdate = Date.now();
      this.debug('updated', agentId);

      return this;
    });
}


function ignoreOldRecords(lastSavedRecordDate, records) {
  return records.skipWhile((record) => record[DATE] <= lastSavedRecordDate);
}


const DATE = Constants.DATE_FEATURE;


module.exports = update;
