async function destroy() {
  const agentId = this.agentId;
  const kit = this.kit;

  // TODO: proper debug
  console.log(`${'-'.repeat(10)} deleting agent "${agentId}".`);

  return kit.client
    .deleteAgent(agentId)
    .then(() => {
      delete this.agent;

      return;
    })
    .catch(/* istanbul ignore next */(error) => {
      // TODO: proper error handling
      throw error;
    });
}


module.exports = destroy;
