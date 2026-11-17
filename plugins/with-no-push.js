/**
 * The app only uses local notifications. expo-notifications adds the push
 * entitlement (aps-environment) by default, which a free Apple developer account
 * cannot sign. This plugin removes it. Listed before expo-notifications in app.json
 * because config mods run in reverse order of registration.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withNoPush(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
