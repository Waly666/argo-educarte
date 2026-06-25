const { Router } = require('express');
const ctrl = require('../controllers/webhookController');

const router = Router();

router.post('/wompi', ctrl.wompi);

module.exports = router;
