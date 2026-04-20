const asyncHandler = require('../../utils/async-handler');
const { saveUserPreferences } = require('./users.service');

const savePreferencesHandler = asyncHandler(async (req, res) => {
  const { amenities = [], equipments = [], services = [] } = req.body;

  const user = await saveUserPreferences(req.user.id, { amenities, equipments, services });

  res.status(200).json({
    success: true,
    message: 'Preferences saved successfully.',
    data: { preferences: user.preferences },
  });
});

module.exports = { savePreferencesHandler };
