import './config/env.js';
/**
 * server.js — Production-ready Express server
 *
 * Security stack applied in order:
 *   1. helmet()        — sets secure HTTP headers
 *   2. cors()          — only allows whitelisted origins
 *   3. express-rate-limit — throttles requests per IP
 *   4. express-mongo-sanitize — strips $ and . from user inputs (NoSQL injection)
 *   5. express.json({ limit }) — request body size limit
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import connectDB from './config/db.js';
import { errorHandler, notFound } from './middleware/error.js';

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

// ─── Validate critical environment variables ──────────────────────────────────
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const app = express();

// ─── Security: HTTP headers ───────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary images
}));

// ─── Security: CORS ───────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman) in dev mode
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Security: Rate limiting ──────────────────────────────────────────────────
// General API rate limit
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 300,                    // 300 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' },
}));

// Stricter limit for auth routes (prevent brute force)
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' },
}));

// AI routes — limited to prevent API key abuse
app.use('/api/ai/', rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 20,                    // 20 AI requests per minute per IP
  message: { success: false, message: 'AI rate limit reached. Please wait a moment.' },
}));

// ─── Request parsing ──────────────────────────────────────────────────────────
// Large enough for profile/projects/roadmap JSON; uploads use multipart (multer), not this limit.
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

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
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

// ─── 404 + Global Error Handler ───────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
await connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});
