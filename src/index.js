const craftai = require('craft-ai');
const debug = require('debug');
const uuid = require('uuid/v5');

const Constants = require('./constants');
const CsvParser = require('./parsers/csv');
const Kit = require('./kit');
const Provider = require('./provider');
const Utils = require('./utils');

const DEBUG_PREFIX = Constants.DEBUG_PREFIX;
const ROOT_NAMESPACE = uuid.DNS;

/**
 * @typedef Configuration
 * @type {object}
 * @property {String} token [REQUIRED] craft ai token
 * @property {String} [secret] [RECOMMENDED] used to derive and anonymise the unique identifiers of
 * an endpoint when creating the related craft ai agents. If not specified,
 * each agent will use the same identifier as the endpoint's identifier.
 * @property {String} [zone] [OPTIONAL] IANA zone or a fixed-offset name.
 * @property {Number} [recordBulkSize] [OPTIONAL] number of bulk operations to send with the craft ai client
 * @property {Array<Provider>} [providers] [OPTIONAL] providers to load by default
 * @property {String} [namespace] [OPTIONAL] used with the secret to anonymise the agents name
 */

/**
 * Initialize the energy kit
 *
 * @param {Configuration} [configuration={}] Configuration of the energy kit. Token must be set and secret is recommended.
 * @returns
 */
async function initialize(configuration = {}) {
  const log = debug(DEBUG_PREFIX);

  log('initializing');

  if (configuration === null || typeof configuration !== 'object') {
    throw new TypeError(`The kit's configuration must be an "object". Received "${configuration === null ? 'null' : typeof configuration}".`);
  }

  const token = configuration.token || process.env.CRAFT_AI_TOKEN || process.env.CRAFT_TOKEN;
  const secret = configuration.secret;
  const zone = configuration.zone;

  if (!token) {
    throw new Error('A craft ai access token is required to initialize the kit. The token must be provided either as part of the kit\'s configuration or through the environment variable "CRAFT_AI_TOKEN", but none was found.');
  }
  if (typeof token !== 'string') {
    throw new TypeError(`The "token" property of the kit's configuration must be a "string". Received "${typeof token}".`);
  }

  configuration.token = token;

  /* istanbul ignore else */
  if (secret !== undefined) {
    if (typeof secret !== 'string') {
      throw new TypeError(`The "secret" property of the kit's configuration must be a "string". Received "${typeof secret}".`);
    }
    if (!secret) {
      throw new RangeError('The "secret" property of the kit\'s configuration must be a non-empty "string".');
    }

    configuration.namespace = uuid(secret, ROOT_NAMESPACE);
  }
  else if (process.env.NODE_ENV !== 'test') {
    console.warn('WARNING: No secret was defined in the kit\'s configuration.');
  }

  if (zone !== undefined) {
    if (Utils.isNotString(zone)) {
      throw new TypeError(`The "zone" property of the kit's configuration must be a "string". Received "${typeof zone}".`);
    }
    if (!Utils.checkZone(zone)) {
      throw new RangeError('The "zone" property of the kit\'s configuration must be a valid IANA zone or a fixed-offset name.');
    }
  }

  const providers = configuration.providers;
  const client = createClient(token, configuration.recordBulkSize);
  const kit = Object.create(Kit, {
    configuration: { value: configuration },
    debug: { value: log },
    client: { value: client }
  });

  log('created and linked to the project "%s/%s"', client.cfg.owner, client.cfg.project);

  if (providers !== undefined) {
    if (!Array.isArray(providers)) {
      throw new TypeError(`The "providers" property of the kit's configuration must be an "array". Received "${typeof providers}".`);
    }

    await Promise
      .all(providers.map(Provider.initialize))
      .then((providers) => configuration.providers = providers);
  }
  else {
    configuration.providers = [];
  }

  log('initialized');

  return kit;
}

function createClient(token, bulkSize) {
  // TODO: proper error handling
  return craftai.createClient({
    token,
    operationsChunksSize: bulkSize
  });
}

module.exports = {
  craftai,
  initialize,
  import: {
    csv: CsvParser.stream
  }
};
