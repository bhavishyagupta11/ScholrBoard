import mongoose from 'mongoose';

const validateObjectId = (...paramNames) => (req, res, next) => {
  for (const paramName of paramNames) {
    const value = req.params[paramName];
    if (value !== undefined && !mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName}`,
      });
    }
  }

  return next();
};

export default validateObjectId;
