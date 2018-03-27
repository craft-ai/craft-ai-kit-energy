const craftaiErrors = require('craft-ai/lib/errors');
const luxon = require('luxon');

const Constants = require('../constants');
const Utils = require('../utils');


async function retrieveRecords(from, to) {
  const client = this.kit.client;
  const generated = this.generated;
  const parsedFrom = Utils.parseTimestamp(from);
  const parsedTo = Utils.parseTimestamp(to);

  return client
    .getAgentStateHistory(this.agentId, parsedFrom, parsedTo)
    .then((history) => history.map((operation) => {
      Object.assign(operation, operation.sample);
      operation[DATE] = DateTime.fromMillis(operation[TIMESTAMP] * 1000).toJSDate();
      generated.forEach((key) => delete operation[key]);
      delete operation[TIMESTAMP];
      delete operation[TIMEZONE];
      delete operation.sample;

      return operation;
    }))
    .catch((error) => {
      /* istanbul ignore else */
      if (error instanceof craftaiErrors.CraftAiBadRequestError && error.message.includes('[AgentContextNotFound]'))
        return [];

      /* istanbul ignore next */
      // TODO: proper error handling
      throw error;
    });
}

async function retrievePredictiveModel(modelDate) {
  const client = this.kit.client;
  const parsedModelDate = Utils.parseTimestamp(modelDate);

  return client
    .getAgentDecisionTree(this.agentId, parsedModelDate)
    .catch(/* istanbul ignore next */(error) => {
      // TODO: proper error handling
      throw error;
    });
}


const DATE = Constants.DATE_FEATURE;
const TIMESTAMP = Constants.TIMESTAMP_FEATURE;
const TIMEZONE = Constants.TIMEZONE_FEATURE;

const DateTime = luxon.DateTime;


module.exports = {
  records: retrieveRecords,
  predictiveModel: retrievePredictiveModel,
};
