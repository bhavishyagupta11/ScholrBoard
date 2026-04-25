const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    body: req.body
  });
  
  res.status(statusCode).json({
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