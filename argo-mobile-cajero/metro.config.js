const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** Ruta real en disco (evita fallos de Metro en Windows con ARGO-MOBILE-CAJERO vs argo-mobile-cajero). */
const projectRoot = fs.realpathSync.native(path.resolve(__dirname));

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [projectRoot];

module.exports = config;
