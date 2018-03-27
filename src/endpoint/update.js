const buffer = require('most-buffer');
const most = require('most');

const Common = require('./common');
const Constants = require('../constants');


async function update(records) {
  const agentId = this.agentId;

  console.log(`${'-'.repeat(10)} updating agent "${agentId}".`);

  const client = this.kit.client;
  const agent = this.agent;
  const features = this.features;
  const lastSavedRecordDate = agent.lastTimestamp;

  let failed = false;

  return Common
    .toRecordStream(records)
    // TODO: Convert index values to mean electrical loads
    .thru(lastSavedRecordDate === undefined
      ? Common.mergeUntilFirstFullRecord.bind(null, features)
      : ignoreOldRecords.bind(null, lastSavedRecordDate))
    // Send the context operations by bulks.
    .thru(Common.formatRecords.bind(null, features))
    .thru(buffer(client.cfg.operationsChunksSize))
    .filter((history) => history.length)
    .recoverWith((error) => {
      // TODO: proper error handling
      failed = true;

      return most.throwError(error);
    })
    .concatMap((history) => most.fromPromise(client
      .addAgentContextOperations(agentId, history)
      .then(() => history)
      .catch(/* istanbul ignore next */(error) => {
        if (!failed) throw error;
      })))
    // Update agent's local state
    .reduce((agent, history) => {
      if (!agent.firstTimestamp) agent.firstTimestamp = history[0].timestamp;

      agent.lastTimestamp = history[history.length - 1].timestamp;

      return agent;
    }, Object.assign(agent, { lastContextUpdate: Date.now() }))
    .then(() => this);
}


function ignoreOldRecords(lastSavedRecordDate, records) {
  return records.skipWhile((record) => record[DATE] <= lastSavedRecordDate);
}


const DATE = Constants.DATE_FEATURE;


module.exports = update;
