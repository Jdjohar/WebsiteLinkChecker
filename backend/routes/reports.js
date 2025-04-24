const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Report = require('../models/Report');
const Domain = require('../models/Domain');
const { scanLinks } = require('../utils/linkScanner');

router.post('/scan/:domainId', authMiddleware, async (req, res) => {
  try {
    const domain = await Domain.findOne({ _id: req.params.domainId, userId: req.user.userId });
    if (!domain) {
      return res.status(404).json({ message: 'Domain not found or not authorized' });
    }
    const report = await scanLinks(domain.url, domain.schedule);
    const newReport = new Report({
      domainId: domain._id,
      brokenLinks: report.brokenLinks,
      checkedUrls: report.checkedUrls,
    });
    await newReport.save();
    res.status(200).json({ message: 'Scan completed', reportId: newReport._id });
  } catch (error) {
    res.status(500).json({ message: 'Failed to start scan', error: error.message });
  }
});

// List Reports
router.get('/', authMiddleware, async (req, res) => {
  try {
    const reports = await Report.find({ domainId: { $in: await Domain.find({ userId: req.user.userId }).select('_id') } });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;