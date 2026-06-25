const { procesarWebhookWompi } = require('../services/wompiWebhook');

exports.wompi = async (req, res, next) => {
  try {
    const result = await procesarWebhookWompi(req.body || {}, req.headers || {});
    res.status(200).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    next(e);
  }
};
