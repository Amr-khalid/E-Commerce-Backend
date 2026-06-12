/**
 * Custom API Error class with HTTP status codes.
 * Used throughout the application for consistent error handling.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message Error message
   * @param {object} [options]
   * @param {boolean} [options.isOperational=true] Whether this is an expected error
   * @param {Array} [options.errors] Validation errors array
   * @param {string} [options.code] Machine-readable error code
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = options.isOperational !== undefined ? options.isOperational : true;
    this.errors = options.errors || [];
    this.code = options.code || null;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors = []) {
    return new ApiError(400, message, { errors, code: 'BAD_REQUEST' });
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message) {
    return new ApiError(409, message, { code: 'CONFLICT' });
  }

  static unprocessable(message, errors = []) {
    return new ApiError(422, message, { errors, code: 'UNPROCESSABLE_ENTITY' });
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message, { code: 'RATE_LIMITED' });
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, { isOperational: false, code: 'INTERNAL_ERROR' });
  }
}

export default ApiError;
