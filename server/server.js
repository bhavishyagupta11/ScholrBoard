import './config/env.js';

// ─── STARTUP LOGGING ──────────────────────────────────────────────────────────
const logStartup = (msg) => console.log('[STARTUP]', JSON.stringify({ timestamp: new Date().toISOString(), message: msg }));
const logConfig = (msg) => console.log('[CONFIG]', JSON.stringify({ timestamp: new Date().toISOString(), message: msg }));
const logWarning = (msg) => console.log('[WARNING]', JSON.stringify({ timestamp: new Date().toISOString(), message: msg }));
const logShutdown = (msg) => console.log('[SHUTDOWN]', JSON.stringify({ timestamp: new Date().toISOString(), message: msg }));
const logError = (msg, err) => console.error('[ERROR]', JSON.stringify({ timestamp: new Date().toISOString(), message: msg, error: err?.message || String(err) }));

logStartup('INITIALIZING');
logStartup('CONFIG_VALIDATION');

// ─── CONFIGURATION VALIDATION ─────────────────────────────────────────────────
// CATEGORY A: Required Variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingRequired = requiredEnvVars.filter((key) => !process.env[key]);

if (missingRequired.length > 0) {
  console.error('\n==================================');
  console.error('Configuration Error');
  console.error('Missing Required Environment Variables:');
  missingRequired.forEach(v => console.error(`- ${v}`));
  console.error('==================================\n');
  process.exit(1);
}

// Validate MONGODB_URI format
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
  console.error('\n==================================');
  console.error('Configuration Error');
  console.error('Invalid MONGODB_URI format. Must start with mongodb:// or mongodb+srv://');
  console.error('==================================\n');
  process.exit(1);
}
if (/\s/.test(mongoUri)) {
  console.error('\n==================================');
  console.error('Configuration Error');
  console.error('Invalid MONGODB_URI. Contains whitespace.');
  console.error('==================================\n');
  process.exit(1);
}

// CATEGORY B: Optional Features
const checkOptionalFeature = (name, keys) => {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length > 0) {
    logWarning(`${name} disabled. Missing: ${missing.join(', ')}`);
  }
};
checkOptionalFeature('Cloudinary', ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']);
checkOptionalFeature('Gemini AI', ['GEMINI_API_KEY']);
const hasResend = !!(process.env.RESEND_API_KEY || (process.env.SMTP_PASS?.startsWith('re_')));
if (!hasResend) {
  logWarning('Email Service disabled. Missing: RESEND_API_KEY');
} else {
  logStartup('EMAIL_SERVICE_CONFIGURED (Resend HTTPS API)');
}

logStartup('LOGGER_READY');

/**
 * server.js — Express server entry point
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mongoose from 'mongoose';

import connectDB from './config/db.js';
import { errorHandler, notFound } from './middleware/error.js';
import requestLogger from './middleware/requestLogger.js';
import healthRoutes from './routes/health.js';

// ─── Routes ───────────────────────────────────────────────────────────────────
import authRoutes         from './routes/auth.js';
import userRoutes         from './routes/users.js';
import profileRoutes      from './routes/profile.js';
import activityRoutes     from './routes/activities.js';
import analyticsRoutes    from './routes/analytics.js';
import aiRoutes           from './routes/ai.js';
import placementRoutes    from './routes/placements.js';
import eventRoutes        from './routes/events.js';
import notificationRoutes from './routes/notifications.js';
import uploadRoutes       from './routes/upload.js';
import codingRoutes       from './routes/coding.js';
import odRoutes           from './routes/od.js';
import announcementRoutes from './routes/announcements.js';
import opportunityRoutes  from './routes/opportunities.js';
import applicationRoutes  from './routes/applications.js';
import scholarshipRoutes  from './routes/scholarships.js';
import developerSyncRoutes from './routes/developerSync.js';
import supportRoutes       from './routes/support.js';
import ticketRoutes        from './routes/tickets.js';
import trackRoutes         from './routes/tracks.js';
import publicRoutes        from './routes/public.js';

const app = express();
app.set('trust proxy', 1);
app.set('server_listening', false);

// ─── STARTUP: DATABASE ────────────────────────────────────────────────────────
logStartup('DATABASE_CONNECTING');
try {
  await connectDB();
  logStartup('DATABASE_CONNECTED');
} catch (err) {
  logError('Startup failed due to fatal database error', err);
  process.exit(1);
}

// ─── Security: HTTP headers ───────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary images
}));

// ─── Security: CORS ───────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

if (!allowedOrigins.includes('http://localhost:5173')) allowedOrigins.push('http://localhost:5173');
if (!allowedOrigins.includes('http://localhost:3000')) allowedOrigins.push('http://localhost:3000');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Security: Rate limiting ──────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 300 : 10000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
  }));

  app.use('/api/auth/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 20 : 10000,
    message: { success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' },
  }));

  app.use('/api/ai/', rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 20 : 10000,
    message: { success: false, message: 'AI rate limit reached. Please wait a moment.' },
  }));
}

// ─── Request parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
const uploadsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads');
app.use('/uploads', express.static(uploadsDir, {
  fallthrough: false,
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// ─── Security: NoSQL injection + lightweight XSS input hardening ─────────────
const sanitizeString = (value) => value
  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
  .replace(/javascript:/gi, '');

const stripMongoOperators = (value) => {
  if (!value || typeof value !== 'object') return value;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
      continue;
    }
    stripMongoOperators(value[key]);
  }
  return value;
};

const sanitizeInput = (value) => {
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeInput);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = sanitizeInput(value[key]);
  }
  return value;
};

app.use((req, _res, next) => {
  if (req.body) req.body = stripMongoOperators(sanitizeInput(req.body));
  if (req.query) stripMongoOperators(sanitizeInput(req.query));
  if (req.params) stripMongoOperators(sanitizeInput(req.params));
  next();
});

logStartup('MIDDLEWARE_READY');

app.use(requestLogger);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/health',        healthRoutes);
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/profile',       profileRoutes);
app.use('/api/activities',    activityRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/ai',            aiRoutes);
app.use('/api/placements',    placementRoutes);
app.use('/api/events',        eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload',        uploadRoutes);
app.use('/api/coding',        codingRoutes);
app.use('/api/od',            odRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/applications',  applicationRoutes);
app.use('/api/scholarships',  scholarshipRoutes);
app.use('/api/developer',     developerSyncRoutes);
app.use('/api/support',       supportRoutes);
app.use('/api/tickets',       ticketRoutes);
app.use('/api/tracks',        trackRoutes);
app.use('/api/public',        publicRoutes);

logStartup('ROUTES_READY');

// ─── 404 + Global Error Handler ───────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
let server;

const shutdown = async (signal) => {
  logShutdown(`Received ${signal}. Starting graceful shutdown...`);
  
  app.set('server_listening', false);
  
  if (server) {
    await new Promise(resolve => {
      server.close(() => {
        logShutdown('HTTP server closed.');
        resolve();
      });
    });
  }

  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
      logShutdown('MongoDB connection closed.');
    }
  } catch (err) {
    logError('Error closing MongoDB connection', err);
  }

  logShutdown('Shutdown complete. Exiting.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logError('unhandledRejection', reason);
});

process.on('uncaughtException', (err) => {
  logError('uncaughtException', err);
  shutdown('uncaughtException');
});

// ─── STARTUP ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server = app.listen(PORT, () => {
  app.set('server_listening', true);
  logStartup('SERVER_LISTENING');
  logStartup('APPLICATION_READY');
  
  console.log('\n==================================================');
  console.log('ScholrBoard Backend');
  console.log(`Version:       ${process.env.npm_package_version || '1.0.0'}`);
  console.log(`Environment:   ${process.env.NODE_ENV || 'development'}`);
  console.log(`Node Version:  ${process.version}`);
  console.log(`Port:          ${PORT}`);
  console.log(`MongoDB Status:${mongoose.connection.readyState === 1 ? ' Connected' : ' Disconnected'}`);
  console.log('==================================================');
  console.log('Configuration Loaded');
  console.log('Environment Validated');
  console.log('Database Connected');
  console.log('Routes Registered');
  console.log('HTTP Server Listening');
  console.log('Application Ready');
  console.log('==================================================\n');
});
