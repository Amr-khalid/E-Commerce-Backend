import ApiError from '../utils/ApiError.js';

/**
 * 404 Not Found handler for undefined routes.
 * Must be registered after all route definitions.
 */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export { notFound };
