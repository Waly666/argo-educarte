const { Router } = require('express');
const MensajeForo = require('../models/MensajeForo');
const { requirePortalAuth } = require('../middleware/authPortal');
const { requireAuth, requirePermiso } = require('../middleware/auth');

const router = Router();

const moderarForo = requirePermiso(
  'aula_virtual.foro',
  'aula_virtual.gestionar',
  'programas.gestionar',
  'instructores',
);

// ─── Alumno: historial paginado del foro de un curso ─────────────────────────
router.get('/cursos/:idPrograma/mensajes', requirePortalAuth, async (req, res, next) => {
  try {
    const { idPrograma } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 100);
    const skip = (page - 1) * limit;

    const [total, mensajes] = await Promise.all([
      MensajeForo.countDocuments({ idPrograma, eliminado: false }),
      MensajeForo.find({ idPrograma, eliminado: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      mensajes: mensajes.reverse(),
    });
  } catch (e) {
    next(e);
  }
});

// ─── Admin: listar cursos con actividad en foro ───────────────────────────────
router.get('/admin/resumen', requireAuth, moderarForo, async (req, res, next) => {
  try {
    const resumen = await MensajeForo.aggregate([
      { $match: { eliminado: false } },
      {
        $group: {
          _id: '$idPrograma',
          nombrePrograma: { $last: '$nombrePrograma' },
          total: { $sum: 1 },
          ultimo: { $max: '$createdAt' },
        },
      },
      { $sort: { ultimo: -1 } },
    ]);

    res.json(
      resumen.map((r) => ({
        idPrograma: String(r._id),
        nombreProg: r.nombrePrograma || String(r._id),
        codigoProg: '',
        total: r.total,
        ultimo: r.ultimo,
      })),
    );
  } catch (e) {
    next(e);
  }
});

// ─── Admin: mensajes de un curso con filtros ─────────────────────────────────
router.get('/admin/cursos/:idPrograma/mensajes', requireAuth, moderarForo, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    const { idPrograma } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [total, mensajes] = await Promise.all([
      MensajeForo.countDocuments({ idPrograma, eliminado: false }),
      MensajeForo.find({ idPrograma, eliminado: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      mensajes: mensajes.reverse(),
    });
  } catch (e) {
    next(e);
  }
});

// ─── Admin: eliminar mensaje ──────────────────────────────────────────────────
router.delete('/admin/mensajes/:id', requireAuth, moderarForo, async (req, res, next) => {
  try {
    await MensajeForo.findByIdAndUpdate(req.params.id, { eliminado: true });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
