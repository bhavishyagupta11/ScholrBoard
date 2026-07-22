import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import mongoose from "mongoose";

// Helper for structured logging
const logDb = (msg, meta = {}) => {
  console.log('[DATABASE]', JSON.stringify({ timestamp: new Date().toISOString(), message: msg, ...meta }));
};
const errorDb = (msg, err) => {
  console.error('[DATABASE]', JSON.stringify({
    timestamp: new Date().toISOString(),
    message: msg,
    error: err?.message || String(err),
    code: err?.code,
    name: err?.name
  }));
};

// Register all mongoose events
mongoose.connection.on('connecting', () => logDb('Connecting to MongoDB...'));
mongoose.connection.on('connected', () => logDb('MongoDB connected successfully'));
mongoose.connection.on('disconnecting', () => logDb('Disconnecting from MongoDB...'));
mongoose.connection.on('disconnected', () => logDb('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => logDb('MongoDB reconnected'));
mongoose.connection.on('close', () => logDb('MongoDB connection closed'));
mongoose.connection.on('error', (err) => errorDb('MongoDB connection error', err));

const MAX_RETRIES = 5;
const RETRY_DELAYS = [2000, 4000, 8000, 16000, 30000];

const isTransientError = (error) => {
  if (!error) return false;
  // Do not retry on Auth failures, malformed URIs, etc.
  const name = error.name || '';
  const message = (error.message || '').toLowerCase();
  const code = error.code || '';

  if (name === 'MongoParseError' || name === 'MongoAPIError' || name === 'MongoInvalidArgumentError') return false;
  if (message.includes('authentication failed') || message.includes('bad auth')) return false;
  if (message.includes('invalid schema') || message.includes('must begin with mongodb://')) return false;
  
  // Retry on network errors, timeouts, ENOTFOUND, MongoServerSelectionError
  return true; 
};

const connectDB = async (attempt = 1) => {
  try {
    const dbUri = process.env.NODE_ENV === 'test' && process.env.MONGODB_URI_TEST
      ? process.env.MONGODB_URI_TEST
      : process.env.MONGODB_URI;

    if (!dbUri) {
      throw new Error('MONGODB_URI is undefined. Cannot connect.');
    }

    await mongoose.connect(dbUri);

    // Non-blocking syncIndexes
    const models = [
      '../models/User.js',
      '../models/Activity.js',
      '../models/Notification.js',
      '../models/Opportunity.js',
      '../models/Scholarship.js',
      '../models/Application.js',
      '../models/ScholarshipApplication.js',
      '../models/OdRequest.js',
      '../models/AuditLog.js',
    ];
    
    // Fire and forget, don't await, don't crash startup
    Promise.all(models.map(async (modelPath) => {
      const { default: Model } = await import(modelPath);
      await Model.syncIndexes();
    }))
    .then(() => logDb('Database indexes synchronized successfully'))
    .catch(err => errorDb('Non-fatal: Database index synchronization failed', err));

  } catch (error) {
    if (!isTransientError(error)) {
      errorDb('Fatal MongoDB Error (Not Retrying)', error);
      throw error; // Rethrow to be caught by server.js
    }

    if (attempt > MAX_RETRIES) {
      errorDb(`MongoDB connection failed after ${MAX_RETRIES} attempts. Exiting.`);
      throw error; // Rethrow to be caught by server.js
    }

    const delay = RETRY_DELAYS[attempt - 1];
    logDb(`Transient MongoDB error. Retrying attempt ${attempt} in ${delay}ms...`, { attempt, maxRetries: MAX_RETRIES });
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return connectDB(attempt + 1);
  }
};

export default connectDB;
