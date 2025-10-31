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

// ---------- ENVIRONMENT ----------
const FRONTEND_URL = process.env.FRONTEND_URL?.replace(/\/$/, '');
const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/$/, '');
const MONGO_URI = process.env.MONGO_URI;
const IS_VERCEL = !!process.env.VERCEL;

// Basic validation
if (!FRONTEND_URL || !MONGO_URI) {
  console.error('❌ Missing required environment variables.');
}

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

// ---------- DATABASE CONNECTION ----------
let isConnected = false;

async function connectDB() {
  if (isConnected) {
    console.log('⚡ Using cached MongoDB connection');
    return;
  }

  try {
    const db = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = db.connections[0].readyState;
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
}

connectDB();

// ---------- ROUTES ----------
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/stripe', stripeRoutes);
console.log('✅ API routes mounted');

// ---------- HEALTH CHECK ----------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server running' });
});

// ---------- ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error('🔥 Error middleware:', err.stack || err);
  res.status(500).json({ message: 'Internal server error' });
});

// ---------- CRON JOBS ----------
if (!IS_VERCEL) {
  // Vercel functions are ephemeral; cron jobs won't persist
  startCronJobs();
  console.log('✅ Cron jobs started (local only)');
} else {
  console.log('⚠️ Skipping cron jobs on Vercel (use Vercel Cron instead)');
}

// ---------- SERVER START (LOCAL ONLY) ----------
if (!IS_VERCEL) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`🚀 Server running locally on port ${port}`);
  });
} else {
  console.log('✅ Exporting Express app for Vercel');
}

// ---------- EXPORT FOR VERCEL ----------
module.exports = app;
