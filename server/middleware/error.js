import { redactObject } from './requestLogger.js';

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  console.error('[error]', JSON.stringify({
    timestamp: new Date().toISOString(),
    message: err.message,
    path: req.originalUrl,
    method: req.method,
    statusCode,
    userId: req.user?._id?.toString() || null,
    body: req.body ? redactObject(req.body) : undefined,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  }));

  res.status(statusCode).json({
    success: false,
    message: err.message,
    details: err.details || 'No additional details available',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export { errorHandler, notFound };
