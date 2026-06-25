/**
 * Migración inspección preoperacional → inspTecPreop + detInspeccion + catálogos unificados.
 *
 * Uso:
 *   node scripts/migrarInspeccionPreop.js --listar
 *   node scripts/migrarInspeccionPreop.js --confirmar
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Config = require('../src/models/Config');
const InspTecPreop = require('../src/models/InspTecPreop');
const DetInspeccion = require('../src/models/DetInspeccion');
const InspeccionVehiculo = require('../src/models/InspeccionVehiculo');
const Empleado = require('../src/models/Empleado');
const { models } = require('../src/models/catalogos');
const { normClaseVehiculoInspeccion, PRIMERA_REVISION } = require('../src/constants/inspeccionPreop');
const { normSi } = require('../src/utils/inspeccionClaseVehiculo');

const itemsModel = models.itemsInspeccion;
const caractModel = models.caractInspeccion;
const estGralModel = models.itemsEstGral;
const aspecto1Model = models.aspecto1;
const aspecto2Model = models.aspecto2;
const adaptacionesModel = models.adaptaciones;
const claseModel = models.claseVehiculo;

const SECCIONES = [
  { key: 'estadoGeneral', configField: 'idItemsEstGral', model: estGralModel, idField: 'idItemEsGral', labelField: 'item' },
  { key: 'aspecto1', configField: 'idAspecto1', model: aspecto1Model, idField: 'idAspecto1', labelField: 'aspecto1' },
  { key: 'aspecto2', configField: 'idAspecto2', model: aspecto2Model, idField: 'idAspecto2', labelField: 'aspecto2' },
  { key: 'adaptaciones', configField: 'idAdaptaciones', model: adaptacionesModel, idField: 'idAdaptacion', labelField: 'nombre' },
];

function arg(flag) {
  return process.argv.includes(flag);
}

function normIds(raw) {
  return [...new Set((raw || []).map((d) => String(d).trim()).filter(Boolean))];
}

async function etiquetaClasePorId(idClase, clasesById) {
  const k = String(idClase ?? '').trim();
  const row = clasesById.get(k) || clasesById.get(k.match(/^(\d+)/)?.[1] || '');
  return normClaseVehiculoInspeccion(row?.descripcion || '');
}

async function cargarClasesMap() {
  const rows = await claseModel.find({}).lean();
  const byId = new Map();
  for (const r of rows) {
    const id = String(r.idClase ?? '').trim();
    if (id) {
      byId.set(id, r);
      const m = id.match(/^(\d+)/);
      if (m) byId.set(m[1], r);
    }
  }
  return byId;
}

async function migrarCatalogos(dryRun) {
  const existentes = await itemsModel.countDocuments({});
  if (existentes > 0) {
    console.log(`Catálogo itemsInspeccion ya tiene ${existentes} filas — se omite migración de catálogo.`);
    const caracts = await caractModel.find({}).lean();
    const map = new Map();
    for (const c of caracts) {
      const sec = String(c.caracteristica || '').trim();
      map.set(`${sec}:${c.idItem}`, Number(c.idCaracteristica));
    }
    return map;
  }

  const [config, clasesById] = await Promise.all([
    Config.findOne({ clave: 'formatoInspeccionVehiculos' }).lean(),
    cargarClasesMap(),
  ]);

  const catalogRows = {};
  for (const s of SECCIONES) {
    catalogRows[s.key] = await s.model.find({}).lean();
  }

  const byOldId = {};
  for (const s of SECCIONES) {
    byOldId[s.key] = new Map(
      (catalogRows[s.key] || []).map((r) => [String(r[s.idField]), r]),
    );
  }

  let nextItem = 1;
  let nextCaract = 1;
  const caractMap = new Map();
  const itemKeyToId = new Map();

  async function registrarItem(claseVeh, texto, seccion, oldId) {
    const clase = normClaseVehiculoInspeccion(claseVeh) || '';
    const itemText = String(texto || '').trim();
    if (!itemText) return;
    const dedupeKey = `${clase}|${itemText}|${seccion}`;
    let idItem = itemKeyToId.get(dedupeKey);
    if (!idItem) {
      idItem = nextItem++;
      itemKeyToId.set(dedupeKey, idItem);
      if (!dryRun) {
        await itemsModel.create({ idItem, item: itemText, claseVehiculo: clase || null });
      }
    }
    const mapKey = `${seccion}:${oldId}:${clase || '*'}`;
    if (!caractMap.has(mapKey)) {
      const idCaracteristica = nextCaract++;
      caractMap.set(mapKey, idCaracteristica);
      if (!dryRun) {
        await caractModel.create({ idCaracteristica, idItem, caracteristica: seccion });
      }
    }
    caractMap.set(`${seccion}:${oldId}`, caractMap.get(mapKey));
  }

  const requisitos = Array.isArray(config?.requisitosPorClase) ? config.requisitosPorClase : [];

  if (requisitos.length) {
    for (const req of requisitos) {
      const claseVeh = await etiquetaClasePorId(req.idClase, clasesById);
      if (!claseVeh) continue;
      for (const s of SECCIONES) {
        const ids = normIds(req[s.configField]);
        for (const oldId of ids) {
          const row = byOldId[s.key].get(oldId);
          if (!row) continue;
          await registrarItem(claseVeh, row[s.labelField], s.key, oldId);
        }
      }
    }
  } else {
    for (const s of SECCIONES) {
      for (const row of catalogRows[s.key] || []) {
        const oldId = String(row[s.idField]);
        const cv = normClaseVehiculoInspeccion(row.claseVehiculo || row.claseVehiculo) || '';
        await registrarItem(cv, row[s.labelField], s.key, oldId);
      }
    }
  }

  console.log(
    dryRun
      ? `[dry-run] Catálogo: ~${nextItem - 1} ítems, ~${nextCaract - 1} características`
      : `Catálogo migrado: ${nextItem - 1} ítems, ${nextCaract - 1} características`,
  );
  return caractMap;
}

async function documentoPorEmpleado(idEmpleado) {
  const id = Number(idEmpleado);
  if (!Number.isFinite(id)) return '';
  const emp = await Empleado.findOne({ idEmpleado: id }).select('numeroDocumento').lean();
  return String(emp?.numeroDocumento || '').trim();
}

async function migrarInspecciones(dryRun, caractMap) {
  const legacy = await InspeccionVehiculo.find({}).sort({ fecha: 1, hora: 1 }).lean();
  let creadas = 0;
  let detalle = 0;
  let omitidas = 0;

  for (const old of legacy) {
    const placa = String(old.placa || '').trim();
    const fecha = String(old.fecha || '').trim();
    if (!placa || !fecha) continue;

    const ya = await InspTecPreop.findOne({
      $or: [{ legacyInspeccionId: old._id }, { placa, fecha }],
    }).lean();
    if (ya) {
      omitidas++;
      continue;
    }

    const recibeDoc =
      (await documentoPorEmpleado(old.idEmpleadoInstructor)) ||
      String(old.recibe || '').trim();
    const entregaRaw = String(old.quienEntrega || old.entrega || '').trim();
    const esPrimera = entregaRaw.toLowerCase().includes('primera');

    const cab = {
      placa,
      fecha,
      hora: String(old.hora || '').trim(),
      entrega: esPrimera ? PRIMERA_REVISION : entregaRaw,
      recibe: recibeDoc,
      quienEntrega: entregaRaw || PRIMERA_REVISION,
      quienRecibe: String(old.quienRecibe || old.nombreInstructor || '').trim(),
      nombreRecibe: String(old.quienRecibe || old.nombreInstructor || '').trim(),
      idEmpleadoRecibe: old.idEmpleadoInstructor ?? null,
      inspector: String(old.inspector || '').trim(),
      documentoInspector: String(old.documentoInspector || '').trim(),
      combustible: String(old.combustible || '').trim(),
      documentosVehiculo: old.documentosVehiculo || [],
      documentosInstructor: old.documentosInstructor || [],
      aptoLaborar: old.aptoLaborar,
      observacionesGenerales: String(old.observacionesGenerales || '').trim(),
      consecutivo: String(old.consecutivo || '').trim(),
      urlfotoLatDer: String(old.urlfotoLatDer || '').trim(),
      urlfotoLatIzq: String(old.urlfotoLatIzq || '').trim(),
      urlfotoFrontal: String(old.urlfotoFrontal || '').trim(),
      urlfotoPost: String(old.urlfotoPost || '').trim(),
      fechaAudi: old.fechaAudi || new Date(),
      userAddReg: old.userAddReg || '',
      userChangeRecord: old.userChangeRecord || '',
      fechaMod: old.fechaMod || null,
      legacyInspeccionId: old._id,
    };

    if (dryRun) {
      creadas++;
      for (const s of SECCIONES) {
        detalle += (old[s.key] || []).length;
      }
      continue;
    }

    const created = await InspTecPreop.create(cab);
    creadas++;
    const filas = [];
    for (const s of SECCIONES) {
      for (const row of old[s.key] || []) {
        const oldId = String(row.id ?? '');
        const idCaracteristica = caractMap.get(`${s.key}:${oldId}`);
        if (!idCaracteristica) continue;
        const car = await caractModel.findOne({ idCaracteristica }).lean();
        if (!car) continue;
        filas.push({
          idInspeccion: created._id,
          idItem: car.idItem,
          idCaracteristica,
          aprobado: normSi(row.si),
          observacion: String(row.observacion || '').trim(),
        });
      }
    }
    if (filas.length) {
      await DetInspeccion.insertMany(filas);
      detalle += filas.length;
    }
  }

  console.log(
    dryRun
      ? `[dry-run] Inspecciones: ${creadas} cabeceras, ~${detalle} detalles, ${omitidas} ya existentes`
      : `Inspecciones migradas: ${creadas} cabeceras, ${detalle} detalles, ${omitidas} omitidas`,
  );
}

async function main() {
  const dryRun = !arg('--confirmar');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/argo';
  await mongoose.connect(uri);
  console.log(dryRun ? 'Modo listar (dry-run). Use --confirmar para aplicar.' : 'Aplicando migración…');

  const caractMap = await migrarCatalogos(dryRun);
  await migrarInspecciones(dryRun, caractMap);

  await mongoose.disconnect();
  console.log('Listo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
