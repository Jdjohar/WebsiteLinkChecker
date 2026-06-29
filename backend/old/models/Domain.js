const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema({
  url: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  schedule: { type: String, required: true, enum: ['daily', 'weekly', 'monthly'] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Domain', domainSchema);