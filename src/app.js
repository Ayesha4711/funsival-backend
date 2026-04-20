const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const { nodeEnv, frontendUrl } = require('./config/env');
const apiRoutes = require('./routes');
const errorHandler = require('./middlewares/error.middleware');
const notFoundHandler = require('./middlewares/not-found.middleware');

const app = express();

app.disable('x-powered-by');

const allowedOrigins = frontendUrl.split(',').map((o) => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (Postman, mobile apps, etc.)
    if (!origin) return callback(null, true);
    // In development, allow any localhost origin regardless of port
    if (nodeEnv === 'development' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Allow VS Code dev tunnel origins in development
    if (nodeEnv === 'development' && /^https:\/\/[a-z0-9-]+\.devtunnels\.ms$/.test(origin)) {
      return callback(null, true);
    }
    // Allow ngrok tunnel origins in development
    if (nodeEnv === 'development' && /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/.test(origin)) {
      return callback(null, true);
    }
    // In production, only allow whitelisted origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Funsival backend is running.',
  });
});

app.get('/health', (req, res) => {
  const isDatabaseConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      database: isDatabaseConnected ? 'connected' : 'disconnected',
    },
  });
});

app.use('/api/v1', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
