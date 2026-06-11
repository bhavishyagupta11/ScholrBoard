const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'jwt',
  'secret',
  'jwt_secret',
  'apikey',
  'api_key',
  'refreshToken',
]);

const redactValue = (key, value) => {
  if (SENSITIVE_KEYS.has(String(key).toLowerCase())) return '[REDACTED]';
  if (typeof value === 'string' && value.length > 80 && /^Bearer\s/i.test(value)) {
    return '[REDACTED]';
  }
  return value;
};

const redactObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => redactObject(item));

  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      out[key] = redactObject(value);
    } else {
      out[key] = redactValue(key, value);
    }
  }
  return out;
};

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const entry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
      userId: req.user?._id?.toString() || null,
    };

    if (process.env.NODE_ENV !== 'production' && req.body && Object.keys(req.body).length > 0) {
      entry.body = redactObject(req.body);
    }

    if (res.statusCode >= 500) {
      console.error('[request]', JSON.stringify(entry));
    } else if (process.env.REQUEST_LOG_LEVEL === 'verbose') {
      console.log('[request]', JSON.stringify(entry));
    }
  });

  next();
};

export { redactObject, requestLogger };
export default requestLogger;
