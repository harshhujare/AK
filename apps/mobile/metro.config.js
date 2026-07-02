// metro.config.js — Expo monorepo configuration
// Enables Metro to resolve packages from the workspace root node_modules
// Required because create-expo-app installs deps locally but the monorepo
// root may also have shared packages that need to be resolved.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the workspace root (two levels up from apps/mobile)
const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo (needed for shared packages)
config.watchFolders = [workspaceRoot];

// 2. Let Metro resolve packages from both the mobile app and the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve from the project root first (avoids duplicate React)
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
