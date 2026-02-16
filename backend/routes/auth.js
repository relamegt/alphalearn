const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, requireFirstLogin } = require('../middleware/auth');
const { loginLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { validateLogin, validatePasswordChange, validatePasswordReset, validateOTP, validateProfileCompletion } = require('../middleware/validation');

// Public routes
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', otpLimiter, validatePasswordReset, authController.forgotPassword);
router.post('/reset-password', validateOTP, authController.resetPassword);

// Protected routes
router.use(verifyToken);

router.post('/logout', authController.logout);
router.get('/me', authController.getCurrentUser);
router.post('/change-password', validatePasswordChange, authController.changePassword);
router.get('/verify-session', authController.verifySession);

// Complete first login profile (only for first-time users)
router.post('/complete-profile', requireFirstLogin, validateProfileCompletion, authController.completeFirstLoginProfile);

module.exports = router;
