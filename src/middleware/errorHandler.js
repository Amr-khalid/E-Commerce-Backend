import config from '../config/index.js';
import logger from '../config/logger.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Centralized error handler middleware.
 * Must be registered LAST in the middleware chain.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];
  let code = err.code || 'INTERNAL_ERROR';

  // ─── Mongoose Validation Error ─────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // ─── Mongoose Cast Error (invalid ObjectId) ────────
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ─── Mongoose Duplicate Key Error ──────────────────
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for '${field}': '${err.keyValue[field]}'`;
  }

  // ─── JWT Errors ────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expired';
  }

  // ─── Multer Errors ─────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    code = 'FILE_TOO_LARGE';
    message = `File size exceeds the limit of ${config.upload.maxFileSize / (1024 * 1024)}MB`;
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = 400;
    code = 'TOO_MANY_FILES';
    message = `Maximum ${config.upload.maxFiles} files allowed`;
  }

  // ─── Log Error ─────────────────────────────────────
  if (statusCode >= 500) {
    logger.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?._id,
    });
  } else if (statusCode >= 400) {
    logger.warn('Client Error:', {
      statusCode,
      message,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  }

  // ─── Send Response ─────────────────────────────────
  const response = {
    success: false,
    message,
    code,
  };

  if (errors.length > 0) {
    response.errors = errors;
  }

  // Include stack trace in development only
  if (config.env === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export { errorHandler };
