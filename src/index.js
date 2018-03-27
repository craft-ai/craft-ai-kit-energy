const craftai = require('craft-ai');
const debug = require('debug');
const uuid = require('uuid/v5');

const Constants = require('./constants');
const Kit = require('./kit');


async function initialize(configuration = {}) {
  const log = debug(DEBUG_PREFIX);

  log('initializing');

  if (configuration === null || typeof configuration !== 'object')
    throw new TypeError(`The kit's configuration must be an "object". Received "${configuration === null ? 'null' : typeof configuration}".`);

  const token = configuration.token || process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN;
  const secret = configuration.secret;

  if (!token)
    throw new Error('A craft ai access token is required to initialize the kit. The token must be provided either as part of the kit\'s configuration or through the environment variable "CRAFT_AI_TOKEN", but none was found.');
  if (typeof token !== 'string')
    throw new TypeError(`The "token" property of the kit's configuration must be a "string". Received "${typeof token}".`);

  configuration.token = token;

  /* istanbul ignore else */
  if (secret !== undefined) {
    if (typeof secret !== 'string')
      throw new TypeError(`The "secret" property of the kit's configuration must be a "string". Received "${typeof secret}".`);
    if (!secret)
      throw new RangeError('The "secret" property of the kit\'s configuration must be a non-empty "string".');

    configuration.namespace = uuid(secret, ROOT_NAMESPACE);
  } else if (process.env.NODE_ENV !== 'test') console.warn('WARNING: No secret was defined in the kit\'s configuration.');

  const client = createClient(token, configuration.recordBulkSize);

  log('initialized and linked to the project "%s/%s"', client.cfg.owner, client.cfg.project);

  return Object.create(Kit, {
    configuration: { value: configuration },
    debug: { value: log },
    client: { value: client },
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


const DEBUG_PREFIX = Constants.DEBUG_PREFIX;
const DEFAULT_RECORD_BULK_SIZE = Constants.DEFAULT_RECORD_BULK_SIZE;
const ROOT_NAMESPACE = uuid.DNS;


module.exports = {
  initialize,
};
