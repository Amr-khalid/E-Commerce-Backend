import ApiError from '../utils/ApiError.js';

/**
 * Role-Based Access Control middleware.
 * Checks if the authenticated user has the required role(s) or permission(s).
 *
 * Usage:
 *   authorize('admin', 'manager')           — require one of these roles
 *   authorizePermission('products.create')   — require specific permission
 */

/**
 * Require user to have one of the specified roles.
 * @param  {...string} roles Allowed roles
 * @returns {Function} Express middleware
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(`Role '${req.user.role}' is not authorized for this action`),
      );
    }

    next();
  };
}

/**
 * Require user to have one of the specified permissions.
 * @param  {...string} requiredPermissions Required permission strings
 * @returns {Function} Express middleware
 */
export function authorizePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    // Admin always has access
    if (req.user.role === 'admin') {
      return next();
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.some((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasPermission) {
      return next(
        ApiError.forbidden(
          `Missing required permission: ${requiredPermissions.join(' or ')}`,
        ),
      );
    }

    next();
  };
}

/**
 * Require user to be the resource owner or have staff+ role.
 * Used for endpoints where users can access their own resources.
 * @param {Function} getResourceUserId Function to extract user ID from request
 * @returns {Function} Express middleware
 */
export function authorizeOwnerOrStaff(getResourceUserId) {
  return async (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    // Staff roles can access any resource
    const staffRoles = ['admin', 'manager', 'staff'];
    if (staffRoles.includes(req.user.role)) {
      return next();
    }

    // Check ownership
    try {
      const resourceUserId = await getResourceUserId(req);
      if (String(resourceUserId) === String(req.user._id)) {
        return next();
      }
    } catch {
      // If extraction fails, deny access
    }

    next(ApiError.forbidden('You can only access your own resources'));
  };
}
