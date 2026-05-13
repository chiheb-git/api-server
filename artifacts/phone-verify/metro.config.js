const { getDefaultConfig } = require("expo/metro-config");

// Ensure Expo Router web context variables exist in monorepo/Windows setups.
process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || "./app";
process.env.EXPO_ROUTER_IMPORT_MODE = process.env.EXPO_ROUTER_IMPORT_MODE || "sync";

module.exports = getDefaultConfig(__dirname);
