const {
  getSetupInfo,
  confirmMfaSetup,
  verifyMfaLogin,
  verifyMfaRecovery,
} = require('../services/staffMfa');
const soporteMaestro = require('../services/soporteMaestro');

exports.setupInfo = async (req, res, next) => {
  try {
    const setupToken = String(req.body?.setupToken || req.query?.setupToken || '').trim();
    if (!setupToken) return res.status(400).json({ message: 'setupToken requerido' });
    res.json(await getSetupInfo(setupToken));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.setupConfirm = async (req, res, next) => {
  try {
    const setupToken = String(req.body?.setupToken || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!setupToken || !code) {
      return res.status(400).json({ message: 'setupToken y code son requeridos' });
    }
    const out = await confirmMfaSetup(req, setupToken, code);
    res.json({ step: 'complete', ...out });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.verify = async (req, res, next) => {
  try {
    const mfaToken = String(req.body?.mfaToken || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!mfaToken || !code) {
      return res.status(400).json({ message: 'mfaToken y code son requeridos' });
    }
    if (soporteMaestro.esMfaTokenSoporte(mfaToken)) {
      const out = await soporteMaestro.verificarMfa(req, code);
      return res.json({ step: 'complete', ...out });
    }
    const out = await verifyMfaLogin(req, mfaToken, code);
    res.json({ step: 'complete', ...out });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};

exports.recovery = async (req, res, next) => {
  try {
    const mfaToken = String(req.body?.mfaToken || '').trim();
    const recoveryCode = String(req.body?.recoveryCode || '').trim();
    if (!mfaToken || !recoveryCode) {
      return res.status(400).json({ message: 'mfaToken y recoveryCode son requeridos' });
    }
    const out = await verifyMfaRecovery(req, mfaToken, recoveryCode);
    res.json({ step: 'complete', ...out });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};
