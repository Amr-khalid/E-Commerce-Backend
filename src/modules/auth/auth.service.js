import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Role from '../../models/Role.js';
import config from '../../config/index.js';
import ApiError from '../../utils/ApiError.js';
import { sha256, generateToken } from '../../utils/crypto.js';
import EmailService from '../../services/EmailService.js';
import logger from '../../config/logger.js';

class AuthService {
  /**
   * Register a new customer account.
   */
  static async register({ firstName, lastName, email, phone, password }) {
    // Check existing user
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      throw ApiError.conflict('Email already registered');
    }

    // Get customer role
    const customerRole = await Role.findOne({ name: 'customer' });
    if (!customerRole) {
      throw ApiError.internal('Customer role not configured');
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      role: customerRole._id,
    });

    // Send welcome email (non-blocking)
    EmailService.sendWelcome(user).catch((err) => {
      logger.warn('Failed to send welcome email:', err.message);
    });

    // Generate tokens
    const tokens = this._generateTokens(user._id);
    await this._saveRefreshToken(user._id, tokens.refreshToken);

    return {
      user: this._sanitizeUser(user, customerRole.name),
      tokens,
    };
  }

  /**
   * Login with email and password.
   */
  static async login({ email, password }) {
    const user = await User.findOne({ email })
      .select('+password +loginAttempts +lockedUntil')
      .populate('role', 'name permissions');

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account is deactivated');
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw ApiError.forbidden('Account is temporarily locked. Please try again later.');
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementLoginAttempts();
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Reset login attempts on success
    await user.resetLoginAttempts();

    // Generate tokens
    const tokens = this._generateTokens(user._id);
    await this._saveRefreshToken(user._id, tokens.refreshToken);

    return {
      user: this._sanitizeUser(user, user.role.name),
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token.
   */
  static async refreshToken(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.userId)
      .select('+refreshTokenHash')
      .populate('role', 'name');

    if (!user || !user.refreshTokenHash) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Verify refresh token hash
    const hash = sha256(refreshToken);
    if (hash !== user.refreshTokenHash) {
      // Possible token theft — invalidate all tokens
      user.refreshTokenHash = undefined;
      await user.save();
      throw ApiError.unauthorized('Refresh token has been revoked');
    }

    // Rotate tokens
    const tokens = this._generateTokens(user._id);
    await this._saveRefreshToken(user._id, tokens.refreshToken);

    return { tokens };
  }

  /**
   * Logout — invalidate refresh token.
   */
  static async logout(userId) {
    await User.findByIdAndUpdate(userId, {
      $unset: { refreshTokenHash: 1 },
    });
  }

  /**
   * Request password reset.
   */
  static async forgotPassword(email) {
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const resetToken = generateToken(32);
    const hashedToken = sha256(resetToken);

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send email (non-blocking)
    EmailService.sendPasswordReset(user, resetToken).catch((err) => {
      logger.warn('Failed to send password reset email:', err.message);
    });
  }

  /**
   * Reset password using token.
   */
  static async resetPassword(token, newPassword) {
    const hashedToken = sha256(token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokenHash = undefined; // Invalidate existing sessions
    user.loginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();
  }

  // ─── Private Helpers ────────────────────────────────

  static _generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn },
    );

    const refreshToken = jwt.sign(
      { userId },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn },
    );

    return { accessToken, refreshToken };
  }

  static async _saveRefreshToken(userId, refreshToken) {
    const hash = sha256(refreshToken);
    await User.findByIdAndUpdate(userId, { refreshTokenHash: hash });
  }

  static _sanitizeUser(user, roleName) {
    return {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: roleName,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }
}

export default AuthService;
