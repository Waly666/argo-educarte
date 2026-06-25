const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { createCorsOptions } = require('./config/cors');
const { trustProxyHops } = require('./config/security');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { auditoriaHttpMiddleware } = require('./middleware/auditoriaHttp');
const { actividadHttpMiddleware } = require('./middleware/actividadHttp');
const { createHelmetMiddleware } = require('./middleware/security');

const app = express();

app.set('trust proxy', trustProxyHops());
app.use(createHelmetMiddleware());
app.use(cors(createCorsOptions()));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const uploadsDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'argo-api' }));

app.use('/api', actividadHttpMiddleware);
app.use('/api', auditoriaHttpMiddleware);
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
