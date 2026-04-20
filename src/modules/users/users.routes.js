const express = require('express');

const { authenticate } = require('../../middlewares/auth.middleware');
const { savePreferencesHandler } = require('./users.controller');

const router = express.Router();

router.post('/preferences', authenticate, savePreferencesHandler);

module.exports = router;
