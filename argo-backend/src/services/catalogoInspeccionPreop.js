const { models } = require('../models/catalogos');
const { cargarIndiceClases, resolverIdClaseVehiculo } = require('./configRequisitosDocumentosVehiculos');
const { normClaseVehiculoInspeccion } = require('../constants/inspeccionPreop');

const itemsModel = models.itemsInspeccion;
const caractModel = models.caractInspeccion;

function tiposVehiculoDelItem(row) {
  const tipos = row?.tiposVehiculo;
  if (Array.isArray(tipos) && tipos.length) {
    return [...new Set(tipos.map((t) => normClaseVehiculoInspeccion(t)).filter(Boolean))];
  }
  const legacy = normClaseVehiculoInspeccion(row?.claseVehiculo);
  return legacy ? [legacy] : [];
}

function itemAplicaClaseVehiculo(row, claseVehiculo) {
  const tipos = tiposVehiculoDelItem(row);
  if (!tipos.length) return true;
  if (!claseVehiculo) return false;
  return tipos.includes(claseVehiculo);
}

async function resolverClaseVehiculoInspeccion(vehiculo, indiceClases) {
  const indice = indiceClases || (await cargarIndiceClases());
  const idClase = resolverIdClaseVehiculo(vehiculo, indice);
  if (idClase) {
    const row = indice.byId.get(String(idClase)) || indice.byId.get(String(idClase).match(/^(\d+)/)?.[1] || '');
    const desc = normClaseVehiculoInspeccion(row?.descripcion || vehiculo?.claseVehiculo);
    if (desc) return { idClase: String(idClase), claseVehiculo: desc };
  }
  const fallback = normClaseVehiculoInspeccion(vehiculo?.claseVehiculo);
  return { idClase: idClase || '', claseVehiculo: fallback };
}

async function cargarLineasPlantilla(claseVehiculo) {
  const [items, caracts] = await Promise.all([
    itemsModel.find({}).sort({ idItem: 1 }).lean(),
    caractModel.find({}).sort({ idCaracteristica: 1 }).lean(),
  ]);

  const itemsById = new Map();
  for (const it of items) {
    if (it.idItem == null || it.idItem === '') continue;
    if (!itemAplicaClaseVehiculo(it, claseVehiculo)) continue;
    itemsById.set(Number(it.idItem), it);
  }

  const lineas = [];
  for (const c of caracts) {
    const idItem = Number(c.idItem);
    const idCaracteristica = Number(c.idCaracteristica);
    if (!Number.isFinite(idItem) || !Number.isFinite(idCaracteristica)) continue;
    const it = itemsById.get(idItem);
    if (!it) continue;
    const nombre = String(c.caracteristica || '').trim();
    if (!nombre) continue;
    const itemTitulo = String(it.item || '').trim() || `Ítem ${idItem}`;
    lineas.push({
      id: String(idCaracteristica),
      idItem,
      idCaracteristica,
      itemTitulo,
      nombre,
      si: null,
      observacion: '',
    });
  }

  lineas.sort((a, b) => {
    if (a.idItem !== b.idItem) return a.idItem - b.idItem;
    return a.idCaracteristica - b.idCaracteristica;
  });

  return lineas;
}

function agruparLineasPorItem(lineas) {
  const byItem = new Map();
  for (const l of lineas || []) {
    const idItem = Number(l.idItem);
    if (!Number.isFinite(idItem)) continue;
    let grupo = byItem.get(idItem);
    if (!grupo) {
      grupo = {
        idItem,
        titulo: String(l.itemTitulo || l.titulo || `Ítem ${idItem}`).trim(),
        lineas: [],
      };
      byItem.set(idItem, grupo);
    }
    grupo.lineas.push({
      id: String(l.id),
      idItem,
      idCaracteristica: l.idCaracteristica,
      nombre: String(l.nombre || '').trim(),
      si: l.si ?? null,
      observacion: String(l.observacion || '').trim(),
    });
  }

  return [...byItem.values()].sort((a, b) => a.idItem - b.idItem);
}

async function plantillaChecklistPorVehiculo(vehiculo) {
  const indice = await cargarIndiceClases();
  const { idClase, claseVehiculo } = await resolverClaseVehiculoInspeccion(vehiculo, indice);
  if (!claseVehiculo) {
    return { idClase, claseVehiculo: '', lineas: [], grupos: [] };
  }
  const lineas = await cargarLineasPlantilla(claseVehiculo);
  return {
    idClase,
    claseVehiculo,
    lineas,
    grupos: agruparLineasPorItem(lineas),
  };
}

function mergeChecklistPreop(plantillaLineas, detalleRows, normSi) {
  const byCaract = new Map((detalleRows || []).map((d) => [String(d.idCaracteristica), d]));
  const merged = (plantillaLineas || []).map((p) => {
    const g = byCaract.get(String(p.idCaracteristica));
    return {
      id: String(p.idCaracteristica),
      idItem: p.idItem,
      idCaracteristica: p.idCaracteristica,
      itemTitulo: p.itemTitulo,
      nombre: p.nombre,
      si: g?.aprobado != null ? normSi(g.aprobado) : null,
      observacion: String(g?.observacion || '').trim(),
    };
  });
  return agruparLineasPorItem(merged);
}

function detalleDesdeGrupos(body, plantillaLineas) {
  const byId = new Map((plantillaLineas || []).map((p) => [String(p.id), p]));
  const out = [];
  for (const grupo of body?.grupos || []) {
    for (const row of grupo?.lineas || []) {
      const id = String(row?.id ?? row?.idCaracteristica ?? '');
      const plant = byId.get(id);
      if (!plant) continue;
      out.push({
        idItem: plant.idItem,
        idCaracteristica: plant.idCaracteristica,
        aprobado: row.si,
        observacion: String(row.observacion || '').trim(),
      });
    }
  }
  return out;
}

/** Compatibilidad con payloads antiguos (4 secciones). */
function detalleDesdeSecciones(body, plantillaLineas) {
  const byId = new Map((plantillaLineas || []).map((p) => [String(p.id), p]));
  const out = [];
  const secciones = ['estadoGeneral', 'adaptaciones', 'aspecto1', 'aspecto2'];
  for (const sec of secciones) {
    for (const row of body?.[sec] || []) {
      const id = String(row?.id ?? '');
      const plant = byId.get(id);
      if (!plant) continue;
      out.push({
        idItem: plant.idItem,
        idCaracteristica: plant.idCaracteristica,
        aprobado: row.si,
        observacion: String(row.observacion || '').trim(),
      });
    }
  }
  return out;
}

function detalleDesdeBody(body, plantillaLineas) {
  if (Array.isArray(body?.grupos) && body.grupos.length) {
    return detalleDesdeGrupos(body, plantillaLineas);
  }
  return detalleDesdeSecciones(body, plantillaLineas);
}

module.exports = {
  itemAplicaClaseVehiculo,
  resolverClaseVehiculoInspeccion,
  cargarLineasPlantilla,
  agruparLineasPorItem,
  plantillaChecklistPorVehiculo,
  mergeChecklistPreop,
  detalleDesdeGrupos,
  detalleDesdeSecciones,
  detalleDesdeBody,
};
