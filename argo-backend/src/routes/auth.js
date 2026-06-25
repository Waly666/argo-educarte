const { Router } = require('express');
const ctrl = require('../controllers/authController');
const mfa = require('../controllers/mfaController');
const { requireAuth } = require('../middleware/auth');
const { staffLoginLimiter, portalAuthLimiter } = require('../middleware/security');
const { requireTurnstile } = require('../middleware/turnstile');

const router = Router();

router.get('/config', ctrl.configPublica);
router.post('/login', staffLoginLimiter, requireTurnstile({ allowNativeClients: true }), ctrl.login);
router.post('/mfa/setup/info', portalAuthLimiter, mfa.setupInfo);
router.post('/mfa/setup/confirm', portalAuthLimiter, mfa.setupConfirm);
router.post('/mfa/verify', portalAuthLimiter, mfa.verify);
router.post('/mfa/recovery', portalAuthLimiter, mfa.recovery);
router.get('/me', requireAuth, ctrl.me);
router.post('/verificar-admin', requireAuth, ctrl.verificarAdmin);

module.exports = router;
