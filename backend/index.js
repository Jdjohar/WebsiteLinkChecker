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
const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');

// CORS Configuration
app.use(cors({
  origin: frontendUrl,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight OPTIONS requests
app.options('*', cors({
  origin: frontendUrl,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", frontendUrl, process.env.BACKEND_URL],
    },
  },
}));
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
});
app.use('/api/auth', limiter);
app.use('/api/reports/scan', limiter);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/stripe', stripeRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server running' });
});

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// Start Cron Jobs
startCronJobs();

// Start Server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});