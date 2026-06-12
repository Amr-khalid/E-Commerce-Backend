import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from './asyncHandler.js';

/**
 * Authenticate request via JWT access token.
 * Sets req.user with user data + populated role.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // Extract token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Fallback: cookie
  else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw ApiError.unauthorized('Access token is required');
  }

  // Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }

  // Fetch user with role
  const user = await User.findById(decoded.userId)
    .select('+isActive +isReviewBanned')
    .populate('role', 'name permissions')
    .lean();

  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account is deactivated');
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw ApiError.forbidden('Account is temporarily locked');
  }

  // Attach user to request
  req.user = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions || [],
    isReviewBanned: user.isReviewBanned || false,
  };

  next();
});

/**
 * Optional authentication — doesn't fail if no token.
 * Sets req.user if token is valid, otherwise leaves it null.
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const user = await User.findById(decoded.userId)
      .populate('role', 'name permissions')
      .lean();

    if (user && user.isActive) {
      req.user = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.name,
        permissions: user.role.permissions || [],
        isReviewBanned: user.isReviewBanned || false,
      };
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }

  next();
});
