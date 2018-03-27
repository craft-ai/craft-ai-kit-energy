async function destroy() {
  this.debug('destroying');

  const client = this.kit.client;

  return client
    .deleteAgent(this.agentId)
    .then(() => {
      delete this.agent;
      this.debug('the agent has been deleted');
      this.debug('destroyed');
    })
    .catch(/* istanbul ignore next */(error) => {
      // TODO: proper error handling
      throw error;
    });
}


module.exports = destroy;
