const craftai = require('craft-ai');
const uuid = require('uuid/v5');

const Constants = require('./constants');
const Kit = require('./kit');


async function initialize(configuration = {}) {
  const token = configuration.token || process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN;

  // TODO: proper error handling
  if (!token) throw new Error();

  configuration.token = token;

  if (configuration.secret) {
    // TODO: proper error handling
    if (typeof configuration.secret !== 'string') throw new Error();

    configuration.namespace = uuid(configuration.secret, ROOT_NAMESPACE);
  }

  return Object.create(Kit, {
    configuration: { value: configuration },
    client: { value: createClient(token) },
  });
}


function createClient(token, bulkSize = DEFAULT_RECORD_BULK_SIZE) {
  try {
    return craftai.createClient({
      token,
      operationsChunksSize: bulkSize,
    });
  } catch (error) {
    // TODO: proper error handling
    throw error;
  }
}


const ROOT_NAMESPACE = uuid.DNS;
const DEFAULT_RECORD_BULK_SIZE = Constants.DEFAULT_RECORD_BULK_SIZE;


module.exports = {
  initialize,
};
