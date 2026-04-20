const nodemailer = require('nodemailer');

const config = require('../config/env');
const ApiError = require('../utils/api-error');

function isMailConfigured() {
  return Boolean(
    config.mail.host &&
      config.mail.port &&
      config.mail.user &&
      config.mail.pass &&
      config.mail.from
  );
}

function createTransporter() {
  if (!isMailConfigured()) {
    throw new ApiError(
      500,
      'Email service is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM.'
    );
  }

  return nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: {
      user: config.mail.user,
      pass: config.mail.pass,
    },
  });
}

async function sendMail({ to, subject, html, text }) {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: config.mail.from,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  isMailConfigured,
  sendMail,
};
