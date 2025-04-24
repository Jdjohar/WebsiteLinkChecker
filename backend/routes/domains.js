const express = require('express');
const authMiddleware = require('../middleware/auth');
const Domain = require('../models/Domain');
const User = require('../models/User');

const router = express.Router();

// Add Domain
router.post('/', authMiddleware, async (req, res) => {
  const { url, schedule } = req.body;
  try {
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ message: 'Invalid URL. Must be a valid HTTP/HTTPS URL.' });
    }
    const user = await User.findById(req.user.userId);
    const domainCount = await Domain.countDocuments({ userId: req.user.userId });
    const planLimits = { free: 1, basic: 5, advanced: Infinity };
    if (domainCount >= planLimits[user.plan]) {
      return res.status(403).json({ message: `Cannot add more domains. Your ${user.plan} plan allows up to ${planLimits[user.plan]} domain(s).` });
    }
    const existingDomain = await Domain.findOne({ url, userId: req.user.userId });
    if (existingDomain) {
      return res.status(400).json({ message: 'This domain is already added for your account.' });
    }
    const domain = new Domain({ url, userId: req.user.userId, schedule: schedule || (user.plan === 'advanced' ? 'monthly' : 'daily') });
    await domain.save();
    res.status(201).json(domain);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// List Domains
router.get('/', authMiddleware, async (req, res) => {
  try {
    const domains = await Domain.find({ userId: req.user.userId });
    res.json(domains);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Domain
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const domain = await Domain.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!domain) {
      return res.status(404).json({ message: 'Domain not found' });
    }
    res.json({ message: 'Domain deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

module.exports = router;