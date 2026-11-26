import { redactObject } from './requestLogger.js';

const errorHandler = (err, req, res, next) => {
  const uploadStatus = err.name === 'MulterError' ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : null;
  const statusCode = uploadStatus || err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  console.error('[error]', JSON.stringify({
    timestamp: new Date().toISOString(),
    message: err.message,
    path: req.originalUrl.split('?')[0],
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
  const error = new Error(`Not Found - ${req.originalUrl.split('?')[0]}`);
  res.status(404);
  next(error);
};

export { errorHandler, notFound };
