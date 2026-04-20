const User = require('../../models/user.model');
const ApiError = require('../../utils/api-error');

async function saveUserPreferences(userId, preferences) {
  const user = await User.findByIdAndUpdate(
    userId,
    { preferences },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  return user;
}

module.exports = { saveUserPreferences };
