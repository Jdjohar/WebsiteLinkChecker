// index.js
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const domainRoutes = require('./routes/domains');
const reportRoutes = require('./routes/reports');
const stripeRoutes = require('./routes/stripe');
const { startCronJobs } = require('./utils/cron');

const app = express();

// Normalize FRONTEND_URL to remove trailing slash
const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
console.log("1");

// Log webhook URL
const webhookUrl = `${BACKEND_URL || 'http://localhost:3001'}/api/stripe/webhook`;
console.log(`📡 Webhook URL: ${webhookUrl}`);

// ---------- CORS ----------
const corsOptions = {
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
console.log('✅ CORS configured');

// ---------- SECURITY ----------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", FRONTEND_URL, BACKEND_URL],
    },
  },
}));
console.log('✅ Helmet configured');

// ---------- STRIPE WEBHOOK (raw body) ----------
app.use('/api/stripe/webhook', stripeRoutes);
console.log('✅ Stripe webhook route mounted');

// ---------- JSON PARSING ----------
app.use(express.json());
console.log('✅ express.json middleware enabled');

// ---------- RATE LIMITING ----------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
});
app.use(['/api/auth', '/api/reports/scan'], limiter);
console.log('✅ Rate limiting enabled');

// MongoDB Connection
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

connectDB()
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/stripe', stripeRoutes);
console.log('✅ API routes mounted');

// ---------- HEALTH CHECK ----------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});


console.log('Console log print');

// ---------- SERVER START (LOCAL ONLY) ----------
if (!IS_VERCEL) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`🚀 Server running locally on port ${port}`);
  });
} else {
  console.log('✅ Exporting Express app for Vercel');
}

// Start Cron Jobs
startCronJobs();

console.log('Console log print 2');

// Start Server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
module.exports = app;
