import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Global rate limiter — applies to all routes.
 */
export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,   // Disable X-RateLimit-* headers
  handler: (req, res) => {
    ApiResponse.error(res, {
      statusCode: 429,
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMITED',
    });
  },
});

/**
 * Strict rate limiter for auth endpoints (login, register, password reset).
 * More restrictive to prevent brute force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    ApiResponse.error(res, {
      statusCode: 429,
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
      code: 'AUTH_RATE_LIMITED',
    });
  },
});

/**
 * API rate limiter for write operations.
 */
export const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,               // 30 write operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    ApiResponse.error(res, {
      statusCode: 429,
      message: 'Too many write operations. Please slow down.',
      code: 'WRITE_RATE_LIMITED',
    });
  },
});

/**
 * Sensitive operations limiter (password change, email change, etc.).
 */
export const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    ApiResponse.error(res, {
      statusCode: 429,
      message: 'Too many attempts for this sensitive operation.',
      code: 'SENSITIVE_RATE_LIMITED',
    });
  },
});
