import { Router } from 'express';
import * as authCtrl from './auth.controller.js';
import validate from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { authRateLimiter, sensitiveRateLimiter } from '../../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.validation.js';

const router = Router();

router.post('/register', authCtrl.register);
router.post('/login', authRateLimiter, validate(loginSchema), authCtrl.login);
router.post('/refresh', authCtrl.refreshToken);
router.post('/logout', authenticate, authCtrl.logout);
router.post('/forgot-password', sensitiveRateLimiter, validate(forgotPasswordSchema), authCtrl.forgotPassword);
router.post('/reset-password', sensitiveRateLimiter, validate(resetPasswordSchema), authCtrl.resetPassword);

// Profile
router.get('/me', authenticate, authCtrl.getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), authCtrl.updateMe);

export default router;
