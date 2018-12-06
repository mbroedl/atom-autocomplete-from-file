const providerConfig = require('./provider-config');
const FileProvider = require('./file-provider');

module.exports = {
  providers: null,

  activate() {

  },

  deactivate() {
    this.providers = null;
  },

  provide() {
    let providers = [];
    if (this.providers == null) {
      Object.keys(atom.config.get('autocomplete-from-file'))
        .filter((item) => item.startsWith('provider'))
        .forEach((provider) => {
          if (atom.config.get(`autocomplete-from-file.${provider}.enabled`)) {
              let p = new FileProvider(`autocomplete-from-file.${provider}`);
              providers.push(p);
          }
      });
    }
    // TODO add watch for enable disable!
    this.providers = (providers.length > 0) ? providers : null;
    return this.providers
  },
  config: {
      provider1: providerConfig,
      provider2: providerConfig
  }
};
