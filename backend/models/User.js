const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  plan: { type: String, default: 'free', enum: ['free', 'basic', 'advanced'] },
  stripeCustomerId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);