const express = require('express');

const { authenticate } = require('../../middlewares/auth.middleware');
const authController = require('./auth.controller');

const router = express.Router();

router.post('/signup/user', authController.signupUser);
router.post('/signup/host', authController.signupHost);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification-code', authController.resendVerificationCode);
router.post('/google', authController.googleSignIn);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.get('/reset-password/:token', authController.renderResetPasswordPage);
router.post('/reset-password/:token', authController.resetPassword);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
