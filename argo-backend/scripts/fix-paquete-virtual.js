/**
 * Corrige indexHtml de paquetes virtuales (ZIP con carpeta contenedora).
 * Uso: node scripts/fix-paquete-virtual.js [idPrograma]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { resolvePath } = require('../src/middleware/upload');
const { detectarIndexHtml, paqueteListo } = require('../src/services/aulaVirtualPaquete');
const { inyectarBridgeEnPaquete, detectarStoragePrefix } = require('../src/services/aulaVirtualBridge');
const CapacitacionVirtualConfig = require('../src/models/CapacitacionVirtualConfig');

const id = process.argv[2] || null;

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const q = id ? { idPrograma: String(id) } : { rutaPaquete: { $ne: null } };
  const configs = await CapacitacionVirtualConfig.find(q).lean();

  for (const cfg of configs) {
    const abs = resolvePath(cfg.rutaPaquete);
    if (!abs) continue;
    const indexRel = detectarIndexHtml(abs, cfg.indexHtml || 'index.html');
    if (!paqueteListo(abs, indexRel)) {
      console.warn(`[${cfg.idPrograma}] Sin index.html en ${cfg.rutaPaquete}`);
      continue;
    }
    if (indexRel !== (cfg.indexHtml || 'index.html')) {
      await CapacitacionVirtualConfig.updateOne(
        { idPrograma: cfg.idPrograma },
        { $set: { indexHtml: indexRel } },
      );
      console.log(`[${cfg.idPrograma}] indexHtml: ${cfg.indexHtml} -> ${indexRel}`);
    } else {
      console.log(`[${cfg.idPrograma}] indexHtml OK: ${indexRel}`);
    }
    const bridge = inyectarBridgeEnPaquete(abs, indexRel);
    const storagePrefix = detectarStoragePrefix(abs, indexRel);
    if (storagePrefix && storagePrefix !== cfg.storagePrefix) {
      await CapacitacionVirtualConfig.updateOne(
        { idPrograma: cfg.idPrograma },
        { $set: { storagePrefix } },
      );
      console.log(`[${cfg.idPrograma}] storagePrefix: ${storagePrefix}`);
    }
    console.log(`[${cfg.idPrograma}] bridge: ${bridge.inyectados}/${bridge.total} HTML`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
