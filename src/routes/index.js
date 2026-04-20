const express = require('express');

const authRoutes = require('../modules/auth/auth.routes');
const listingsRoutes = require('../modules/listings/listings.routes');
const usersRoutes = require('../modules/users/users.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/listings', listingsRoutes);
router.use('/users', usersRoutes);

module.exports = router;
