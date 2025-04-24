const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  message: 'Too many login attempts, please try again later.',
});

const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 scan requests per window
  message: 'Too many scan requests, please try again later.',
});

module.exports = { authLimiter, scanLimiter };