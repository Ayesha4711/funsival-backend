const config = require('../../config/env');
const { AUTH_PROVIDERS } = require('../../constants/auth-providers');
const User = require('../../models/user.model');
const { sendMail } = require('../../services/mail.service');
const { verifyGoogleIdToken } = require('../../services/google-auth.service');
const { USER_ROLES } = require('../../constants/roles');
const ApiError = require('../../utils/api-error');
const { generateAuthToken } = require('../../utils/token');
const {
  generateEmailVerificationCode,
  hashEmailVerificationCode,
} = require('../../utils/email-verification-code');
const {
  generatePasswordResetToken,
  hashPasswordResetToken,
} = require('../../utils/password-reset-token');
const {
  buildEmailVerificationTemplate,
  buildPasswordResetEmailTemplate,
} = require('./auth.templates');

function buildAuthResponse(user) {
  return {
    token: generateAuthToken(user),
    user: user.toJSON(),
  };
}

function buildPendingVerificationResponse(user) {
  return {
    email: user.email,
    verificationRequired: true,
    verificationExpiresInMinutes: config.emailVerificationCodeTtlMinutes,
  };
}

function getAccountCreatedMessage(role) {
  return role === USER_ROLES.HOST
    ? 'Host account created successfully.'
    : 'User account created successfully.';
}

function getAuthProviders(user) {
  return user.authProviders && user.authProviders.length > 0
    ? user.authProviders
    : [AUTH_PROVIDERS.LOCAL];
}

function hasAuthProvider(user, provider) {
  return getAuthProviders(user).includes(provider);
}

function addAuthProvider(user, provider) {
  user.authProviders = Array.from(new Set([...getAuthProviders(user), provider]));
}

function attachEmailVerificationCode(user) {
  const rawVerificationCode = generateEmailVerificationCode();

  user.isEmailVerified = false;
  user.emailVerificationCode = hashEmailVerificationCode(rawVerificationCode);
  user.emailVerificationExpiresAt = new Date(
    Date.now() + config.emailVerificationCodeTtlMinutes * 60 * 1000
  );

  return rawVerificationCode;
}

async function sendEmailVerificationCode(user, verificationCode) {
  const emailTemplate = buildEmailVerificationTemplate({
    code: verificationCode,
    expiryMinutes: config.emailVerificationCodeTtlMinutes,
  });

  await sendMail({
    to: user.email,
    subject: emailTemplate.subject,
    text: emailTemplate.text,
    html: emailTemplate.html,
  });
}

async function registerUserAccount(payload) {
  const existingUser = await User.findOne({ email: payload.email });

  if (existingUser) {
    if (!existingUser.isEmailVerified) {
      throw new ApiError(
        409,
        'An account with this email already exists but is not verified yet. Please verify your email or resend the verification code.'
      );
    }

    throw new ApiError(409, 'An account with this email already exists.');
  }

  const user = new User({
    ...payload,
    role: USER_ROLES.USER,
    authProviders: [AUTH_PROVIDERS.LOCAL],
  });
  const verificationCode = attachEmailVerificationCode(user);

  await user.save();

  try {
    await sendEmailVerificationCode(user, verificationCode);
  } catch (error) {
    await User.deleteOne({ _id: user._id });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, 'Failed to send email verification code.');
  }

  return buildPendingVerificationResponse(user);
}

async function registerHostAccount(payload) {
  const existingUser = await User.findOne({ email: payload.email });

  if (existingUser) {
    if (!existingUser.isEmailVerified) {
      throw new ApiError(
        409,
        'An account with this email already exists but is not verified yet. Please verify your email or resend the verification code.'
      );
    }

    throw new ApiError(409, 'An account with this email already exists.');
  }

  const user = new User({
    ...payload,
    role: USER_ROLES.HOST,
    authProviders: [AUTH_PROVIDERS.LOCAL],
  });
  const verificationCode = attachEmailVerificationCode(user);

  await user.save();

  try {
    await sendEmailVerificationCode(user, verificationCode);
  } catch (error) {
    await User.deleteOne({ _id: user._id });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, 'Failed to send email verification code.');
  }

  return buildPendingVerificationResponse(user);
}

async function verifyEmailAddress(payload) {
  const user = await User.findOne({ email: payload.email }).select(
    '+emailVerificationCode +emailVerificationExpiresAt'
  );

  if (!user) {
    throw new ApiError(400, 'Invalid email or verification code.');
  }

  if (user.isEmailVerified) {
    throw new ApiError(400, 'Email is already verified.');
  }

  const hashedVerificationCode = hashEmailVerificationCode(payload.code);
  const isCodeValid =
    user.emailVerificationCode === hashedVerificationCode &&
    user.emailVerificationExpiresAt &&
    user.emailVerificationExpiresAt > new Date();

  if (!isCodeValid) {
    throw new ApiError(400, 'Invalid or expired verification code.');
  }

  user.isEmailVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();

  return {
    message: getAccountCreatedMessage(user.role),
    data: buildAuthResponse(user),
  };
}

async function resendEmailVerificationCode(payload) {
  const user = await User.findOne({ email: payload.email }).select(
    '+emailVerificationCode +emailVerificationExpiresAt'
  );

  if (!user || user.isEmailVerified) {
    return;
  }

  const previousVerificationCode = user.emailVerificationCode;
  const previousVerificationExpiresAt = user.emailVerificationExpiresAt;
  const verificationCode = attachEmailVerificationCode(user);

  await user.save();

  try {
    await sendEmailVerificationCode(user, verificationCode);
  } catch (error) {
    user.emailVerificationCode = previousVerificationCode;
    user.emailVerificationExpiresAt = previousVerificationExpiresAt;
    await user.save();

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, 'Failed to resend email verification code.');
  }
}

async function loginAccount(payload) {
  const user = await User.findOne({ email: payload.email }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  if (!hasAuthProvider(user, AUTH_PROVIDERS.LOCAL) || !user.password) {
    throw new ApiError(
      400,
      'This account uses Google sign-in. Please continue with Google.'
    );
  }

  const isPasswordValid = await user.comparePassword(payload.password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  if (!user.isEmailVerified) {
    throw new ApiError(
      403,
      'Email is not verified. Please verify your email before logging in.',
      {
        emailVerificationRequired: true,
      }
    );
  }

  return buildAuthResponse(user);
}

async function googleAuthenticate(payload) {
  const googleAccount = await verifyGoogleIdToken(payload.idToken);

  let user = await User.findOne({
    $or: [{ googleId: googleAccount.googleId }, { email: googleAccount.email }],
  }).select('+emailVerificationCode +emailVerificationExpiresAt');

  if (user) {
    if (user.googleId && user.googleId !== googleAccount.googleId) {
      throw new ApiError(409, 'This email is already linked to another Google account.');
    }

    if (!user.googleId) {
      user.googleId = googleAccount.googleId;
    }

    addAuthProvider(user, AUTH_PROVIDERS.GOOGLE);
    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();

    return buildAuthResponse(user);
  }

  const role = payload.role || USER_ROLES.USER;

  user = await User.create({
    role,
    email: googleAccount.email,
    ...(payload.city ? { city: payload.city } : {}),
    ...(role === USER_ROLES.HOST && payload.agencyName ? { agencyName: payload.agencyName } : {}),
    authProviders: [AUTH_PROVIDERS.GOOGLE],
    googleId: googleAccount.googleId,
    isEmailVerified: true,
  });

  return buildAuthResponse(user);
}

async function getProfileDetails(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User profile not found.');
  }

  return user.toJSON();
}

async function requestPasswordReset(payload) {
  const user = await User.findOne({ email: payload.email });

  if (!user) {
    return;
  }

  const rawResetToken = generatePasswordResetToken();
  const hashedResetToken = hashPasswordResetToken(rawResetToken);

  user.passwordResetToken = hashedResetToken;
  user.passwordResetExpiresAt = new Date(
    Date.now() + config.passwordResetTokenTtlMinutes * 60 * 1000
  );
  await user.save();

  const resetLink = `${config.apiBaseUrl}/api/v1/auth/reset-password/${rawResetToken}`;
  const emailTemplate = buildPasswordResetEmailTemplate({
    resetLink,
    expiryMinutes: config.passwordResetTokenTtlMinutes,
  });

  try {
    await sendMail({
      to: user.email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, 'Failed to send password reset email.');
  }
}

async function isPasswordResetTokenValid(token) {
  const hashedResetToken = hashPasswordResetToken(token);

  const user = await User.findOne({
    passwordResetToken: hashedResetToken,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('_id');

  return Boolean(user);
}

async function resetPasswordAccount(token, payload) {
  const hashedResetToken = hashPasswordResetToken(token);

  const user = await User.findOne({
    passwordResetToken: hashedResetToken,
    passwordResetExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token.');
  }

  user.password = payload.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();
}

module.exports = {
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
};
