const DraftListing = require('../../models/draft-listing.model');

async function saveDraft(userId, payload) {
  const { currentStep, ...draftData } = payload;

  const draft = await DraftListing.findOneAndUpdate(
    { createdBy: userId },
    { $set: { ...draftData, currentStep, createdBy: userId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return draft.toJSON();
}

async function getDraft(userId) {
  const draft = await DraftListing.findOne({ createdBy: userId });
  return draft ? draft.toJSON() : null;
}

async function discardDraft(userId) {
  await DraftListing.findOneAndDelete({ createdBy: userId });
}

module.exports = { saveDraft, getDraft, discardDraft };
