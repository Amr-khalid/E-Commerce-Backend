import AuthService from './auth.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import asyncHandler from '../../middleware/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await AuthService.register(req.body);

  // Set refresh token in httpOnly cookie
  res.cookie('refreshToken', result.tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  ApiResponse.created(res, {
    message: 'Account created successfully',
    data: {
      user: result.user,
      accessToken: result.tokens.accessToken,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await AuthService.login(req.body);

  res.cookie('refreshToken', result.tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ApiResponse.success(res, {
    message: 'Login successful',
    data: {
      user: result.user,
      accessToken: result.tokens.accessToken,
    },
  });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.body.refreshToken || req.cookies.refreshToken;
  if (!token) {
    return ApiResponse.error(res, {
      statusCode: 401,
      message: 'Refresh token required',
    });
  }

  const result = await AuthService.refreshToken(token);

  res.cookie('refreshToken', result.tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ApiResponse.success(res, {
    data: { accessToken: result.tokens.accessToken },
  });
});

export const logout = asyncHandler(async (req, res) => {
  await AuthService.logout(req.user._id);

  res.clearCookie('refreshToken');

  ApiResponse.success(res, { message: 'Logged out successfully' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await AuthService.forgotPassword(req.body.email);

  // Always return success to not reveal if email exists
  ApiResponse.success(res, {
    message: 'If an account with that email exists, a reset link has been sent',
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await AuthService.resetPassword(req.body.token, req.body.password);

  ApiResponse.success(res, {
    message: 'Password reset successful. Please log in with your new password.',
  });
});

export const getMe = asyncHandler(async (req, res) => {
  ApiResponse.success(res, { data: req.user });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { default: User } = await import('../../models/User.js');
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: req.body },
    { new: true, runValidators: true },
  ).populate('role', 'name');

  ApiResponse.success(res, {
    message: 'Profile updated successfully',
    data: user,
  });
});
