const express = require('express');

const { USER_ROLES } = require('../../constants/roles');
const { authenticate, authorizeRoles } = require('../../middlewares/auth.middleware');
const listingsController = require('./listings.controller');
const draftListingsController = require('./draft-listings.controller');

const router = express.Router();

router.use(authenticate);

// Draft routes (host only) — must be before /:listingId to avoid conflict
router.post('/draft', authorizeRoles(USER_ROLES.HOST), draftListingsController.saveDraftHandler);
router.get('/draft', authorizeRoles(USER_ROLES.HOST), draftListingsController.getDraftHandler);
router.delete('/draft', authorizeRoles(USER_ROLES.HOST), draftListingsController.discardDraftHandler);

// Both host and user can read listings
router.get('/', authorizeRoles(USER_ROLES.HOST, USER_ROLES.USER), listingsController.getMyListingsHandler);
router.get('/:listingId', authorizeRoles(USER_ROLES.HOST, USER_ROLES.USER), listingsController.getListingByIdHandler);

// Only host can create, update, delete
router.post('/', authorizeRoles(USER_ROLES.HOST), listingsController.createListingHandler);
router.patch('/:listingId', authorizeRoles(USER_ROLES.HOST), listingsController.updateListingHandler);
router.delete('/:listingId', authorizeRoles(USER_ROLES.HOST), listingsController.deleteListingHandler);

module.exports = router;
