const asyncHandler = require('../../utils/async-handler');
const {
  validateUserSignupPayload,
  validateHostSignupPayload,
  validateLoginPayload,
  validateGoogleAuthPayload,
  validateVerifyEmailPayload,
  validateResendVerificationCodePayload,
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
} = require('./auth.validation');
const {
  registerUserAccount,
  registerHostAccount,
  verifyEmailAddress,
  resendEmailVerificationCode,
  loginAccount,
  googleAuthenticate,
  getProfileDetails,
  requestPasswordReset,
  isPasswordResetTokenValid,
  resetPasswordAccount,
} = require('./auth.service');
const { buildResetPasswordPage } = require('./auth.templates');

const signupUser = asyncHandler(async (req, res) => {
  const payload = validateUserSignupPayload(req.body);
  const signupData = await registerUserAccount(payload);

  res.status(201).json({
    success: true,
    message: 'Verification OTP sent to your email.',
    data: signupData,
  });
});

const signupHost = asyncHandler(async (req, res) => {
  const payload = validateHostSignupPayload(req.body);
  const signupData = await registerHostAccount(payload);

  res.status(201).json({
    success: true,
    message: 'Verification OTP sent to your email.',
    data: signupData,
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const payload = validateVerifyEmailPayload(req.body);
  const verificationResult = await verifyEmailAddress(payload);

  res.status(200).json({
    success: true,
    message: verificationResult.message,
    data: verificationResult.data,
  });
});

const resendVerificationCode = asyncHandler(async (req, res) => {
  const payload = validateResendVerificationCodePayload(req.body);
  await resendEmailVerificationCode(payload);

  res.status(200).json({
    success: true,
    message: 'If an unverified account exists for this email, a verification code has been sent.',
  });
});

const googleSignIn = asyncHandler(async (req, res) => {
  const payload = validateGoogleAuthPayload(req.body);
  const authData = await googleAuthenticate(payload);

  res.status(200).json({
    success: true,
    message: 'Google sign-in successful.',
    data: authData,
  });
});

const login = asyncHandler(async (req, res) => {
  const payload = validateLoginPayload(req.body);
  const authData = await loginAccount(payload);

  res.status(200).json({
    success: true,
    message: 'Login successful.',
    data: authData,
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await getProfileDetails(req.user.id);

  res.status(200).json({
    success: true,
    message: 'Profile fetched successfully.',
    data: {
      user,
    },
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const payload = validateForgotPasswordPayload(req.body);
  await requestPasswordReset(payload);

  res.status(200).json({
    success: true,
    message: 'If an account exists for this email, a password reset link has been sent.',
  });
});

const renderResetPasswordPage = asyncHandler(async (req, res) => {
  const isTokenValid = await isPasswordResetTokenValid(req.params.token);

  res.status(isTokenValid ? 200 : 400).send(buildResetPasswordPage({ isTokenValid }));
});

const resetPassword = asyncHandler(async (req, res) => {
  const payload = validateResetPasswordPayload(req.body);
  await resetPasswordAccount(req.params.token, payload);

  res.status(200).json({
    success: true,
    message: 'Password reset successful. You can now log in with your new password.',
  });
});

module.exports = {
  signupUser,
  signupHost,
  verifyEmail,
  resendVerificationCode,
  googleSignIn,
  login,
  getProfile,
  forgotPassword,
  renderResetPasswordPage,
  resetPassword,
};
