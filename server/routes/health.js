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

/**
 * Authorized read-only GitHub API smoke test helper.
 * Strictly avoids logging or returning any token values, prefixes, or user identifiers.
 */
export async function performGithubSmokeTest() {
  const isConfigured = Boolean(process.env.GITHUB_TOKEN?.trim());
  if (!isConfigured) {
    return {
      configured: false,
      authenticated: false,
      httpStatus: null,
      errorCategory: 'TOKEN_UNCONFIGURED',
      timestamp: new Date().toISOString(),
    };
  }

  const token = process.env.GITHUB_TOKEN.trim();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'ScholrBoard-Diagnostic/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const isOk = response.ok;
    let errorCategory = null;

    if (!isOk) {
      if (response.status === 401) {
        errorCategory = 'BAD_CREDENTIALS';
      } else if (response.status === 403) {
        errorCategory = 'FORBIDDEN_OR_RATE_LIMITED';
      } else {
        errorCategory = `HTTP_${response.status}`;
      }
    }

    return {
      configured: true,
      authenticated: isOk,
      httpStatus: response.status,
      errorCategory,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      configured: true,
      authenticated: false,
      httpStatus: null,
      errorCategory: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      timestamp: new Date().toISOString(),
    };
  }
}

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
    gitCommit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
    renderServiceId: process.env.RENDER_SERVICE_ID || null,
    renderServiceName: process.env.RENDER_SERVICE_NAME || null,
    githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN?.trim()),
    alternativeGithubEnvKeys: ['GH_TOKEN', 'GITHUB_PAT', 'GITHUB_API_TOKEN', 'GITHUB_ACCESS_TOKEN', 'github_token'].filter(k => Boolean(process.env[k]?.trim())),
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

router.get('/diagnostics/github', async (req, res) => {
  const smokeResult = await performGithubSmokeTest();
  res.status(smokeResult.authenticated ? 200 : (smokeResult.configured ? 502 : 200)).json(smokeResult);
});

export default router;
