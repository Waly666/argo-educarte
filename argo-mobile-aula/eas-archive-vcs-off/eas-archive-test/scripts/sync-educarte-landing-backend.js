const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../argo-frontend/src/app/core/constants/portal-landing-defaults.ts');
const outPath = path.join(__dirname, '../argo-backend/src/constants/aulaVirtualLandingDefaults.js');
const src = fs.readFileSync(srcPath, 'utf8');
const start = src.indexOf('export const PORTAL_LANDING_DEFAULTS');
const fundStart = src.indexOf('function mergeServiciosItems');
let block = src.slice(start, fundStart);
block = block.replace(
  /export const PORTAL_LANDING_DEFAULTS: PortalLandingConfig = /,
  'const LANDING_DEFAULTS = ',
);
block = block.replace(
  /JSON\.parse\(JSON\.stringify\(FUNDACION_LANDING_DEFAULTS\)\) as PortalFundacionLanding/g,
  'JSON.parse(JSON.stringify(FUNDACION_LANDING_DEFAULTS))',
);
block = block.replace(/,\s*$/, '');
const out = `const { FUNDACION_LANDING_DEFAULTS } = require('./aulaVirtualFundacionDefaults');

/** Contenido editable del landing del portal aula virtual (valores por defecto). */
${block};

module.exports = { LANDING_DEFAULTS };
`;
fs.writeFileSync(outPath, out);
console.log('Wrote', outPath, out.length, 'bytes');
