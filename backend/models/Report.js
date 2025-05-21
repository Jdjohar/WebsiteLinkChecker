const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  domainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Domain', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  brokenLinks: [
    {
      url: { type: String, required: true },
      status: { type: String, required: true },
      source: { type: String, required: true },
      text: { type: String, required: true },
    },
  ],
  checkedUrls: [{ type: String }],
  allStatuses: [{ url: String, status: String, source: String }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Report', reportSchema);