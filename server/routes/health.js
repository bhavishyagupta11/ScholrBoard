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
      // Ignored for simple health check
    }
  }

  const memory = process.memoryUsage();
  
  const payload = {
    status: dbConnected ? 'ok' : 'degraded',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    memoryUsage: {
      rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
    },
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    mongoState: DB_STATE[dbReadyState] || 'unknown',
    applicationVersion: process.env.npm_package_version || '1.0.0',
    database: {
      connected: dbConnected,
      pingMs: dbPingMs,
    }
  };

  res.status(dbConnected ? 200 : 503).json(payload);
});

router.get('/ready', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const serverListening = req.app.get('server_listening') === true; // Set during startup in server.js
  
  const dependenciesReady = dbConnected; // Expand if more deps are added
  const isReady = dbConnected && serverListening && dependenciesReady;

  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    mongoConnected: dbConnected,
    serverListening: serverListening,
    dependenciesReady: dependenciesReady
  });
});

export default router;
