const axios = require('axios');
const { analyzeWebsite } = require('./broken-link-checker');
const Domain = require('../models/Domain');
const CronJob = require('cron').CronJob;

function startCronJobs() {
  // Daily scans
  new CronJob('0 0 * * *', async () => {
    try {
      const domains = await Domain.find({ schedule: 'daily' });
      for (const domain of domains) {
        await analyzeWebsite(domain.url, domain.userId, domain._id);
      }
      console.log('Daily scans completed');
    } catch (error) {
      console.error('Daily scan error:', error.message);
    }
  }, null, true, 'UTC');

  // Weekly scans
  new CronJob('0 0 * * 0', async () => {
    try {
      const domains = await Domain.find({ schedule: 'weekly' });
      for (const domain of domains) {
        await analyzeWebsite(domain.url, domain.userId, domain._id);
      }
      console.log('Weekly scans completed');
    } catch (error) {
      console.error('Weekly scan error:', error.message);
    }
  }, null, true, 'UTC');

  // Monthly scans
  new CronJob('0 0 1 * *', async () => {
    try {
      const domains = await Domain.find({ schedule: 'monthly' });
      for (const domain of domains) {
        await analyzeWebsite(domain.url, domain.userId, domain._id);
      }
      console.log('Monthly scans completed');
    } catch (error) {
      console.error('Monthly scan error:', error.message);
    }
  }, null, true, 'UTC');

  // Keep server alive (runs every 14 minutes)
  new CronJob('*/14 * * * *', async () => {
    try {
      const healthUrl = `${process.env.BACKEND_URL}/health`;
      await axios.get(healthUrl);
      console.log(`Server pinged: ${healthUrl}`);
    } catch (error) {
      console.error('Server ping error:', {
        message: error.message,
        code: error.code,
        url: `${process.env.BACKEND_URL}/health`,
      });
    }
  }, null, true, 'UTC');
}

module.exports = { startCronJobs };