import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

const DB_STATE = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

const startTime = Date.now();

router.get('/', async (req, res) => {
  const dbReadyState = mongoose.connection.readyState;
  const dbConnected = dbReadyState === 1;

  let dbPingMs = null;
  if (dbConnected) {
    const pingStart = Date.now();
    try {
      await mongoose.connection.db.command({ ping: 1 });
      dbPingMs = Date.now() - pingStart;
    } catch {
      return res.status(503).json({
        success: false,
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        environment: process.env.NODE_ENV || 'development',
        database: {
          connected: false,
          state: DB_STATE[dbReadyState] || 'unknown',
        },
      });
    }
  }

  const healthy = dbConnected;
  const payload = {
    success: healthy,
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || 'development',
    database: {
      connected: dbConnected,
      state: DB_STATE[dbReadyState] || 'unknown',
      pingMs: dbPingMs,
    },
    version: process.env.npm_package_version || '1.0.0',
  };

  res.status(healthy ? 200 : 503).json(payload);
});

export default router;
