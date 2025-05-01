const axios = require('axios');
const { analyzeWebsite } = require('./broken-link-checker');
const Domain = require('../models/Domain');
const User = require('../models/User');
const { CronJob } = require('cron');

function startCronJobs() {
  console.log("🟢 Starting cron jobs...");

  // Daily scans at 2:05 PM IST (14:05 UTC +5:30 = 8:35 UTC, but since you're using 'Asia/Kolkata', just use 14:05)
  new CronJob('26 18 * * *', async () => {
    console.log('🚀 Starting daily scan job at 2:05 PM IST...');
    try {
      const users = await User.find({});
      console.log(`👥 Found ${users.length} users.`);

      for (const user of users) {
        const domains = await Domain.find({ userId: user._id, schedule: 'daily' });
        console.log(`📄 User ${user.email} has ${domains.length} daily domains.`);

        for (const domain of domains) {
          try {
            console.log(`🔍 Scanning ${domain.url} for user ${user.email}`);
            await analyzeWebsite(domain.url, user._id, domain._id);
            console.log(`✅ Completed scan for ${domain.url}`);
          } catch (scanErr) {
            console.error(`❌ Error scanning ${domain.url}:`, scanErr.message);
          }
        }
      }

      console.log('🎉 Daily scans completed for all users.');
    } catch (error) {
      console.error('🛑 Daily scan error:', error.message);
    }
  }, null, true, 'Asia/Kolkata');

  // Weekly scans (Sunday at 12:00 AM UTC)
  new CronJob('0 0 * * 0', async () => {
    try {
      const domains = await Domain.find({ schedule: 'weekly' });
      for (const domain of domains) {
        await analyzeWebsite(domain.url, domain.userId, domain._id);
      }
      console.log('📆 Weekly scans completed');
    } catch (error) {
      console.error('❌ Weekly scan error:', error.message);
    }
  }, null, true, 'UTC');

  // Monthly scans (1st of every month at 12:00 AM UTC)
  new CronJob('0 0 1 * *', async () => {
    try {
      const domains = await Domain.find({ schedule: 'monthly' });
      for (const domain of domains) {
        await analyzeWebsite(domain.url, domain.userId, domain._id);
      }
      console.log('🗓️ Monthly scans completed');
    } catch (error) {
      console.error('❌ Monthly scan error:', error.message);
    }
  }, null, true, 'UTC');

  // Keep-alive ping every 14 minutes
  new CronJob('*/14 * * * *', async () => {
    try {
      const healthUrl = `${process.env.BACKEND_URL}/health`;
      await axios.get(healthUrl);
      console.log(`📡 Server pinged: ${healthUrl}`);
    } catch (error) {
      console.error('❌ Server ping error:', {
        message: error.message,
        code: error.code,
        url: `${process.env.BACKEND_URL}/health`,
      });
    }
  }, null, true, 'UTC');

  // Debug cron: every minute (for dev testing)
  new CronJob('* * * * *', async () => {
    console.log('⏱️ Cron test: running every minute');
  }, null, true, 'UTC');
}

module.exports = { startCronJobs };
