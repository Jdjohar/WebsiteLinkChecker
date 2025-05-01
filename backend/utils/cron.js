const axios = require('axios');
const { analyzeWebsite } = require('./broken-link-checker');
const Domain = require('../models/Domain');
const CronJob = require('cron').CronJob;
const User = require('../models/User');



function startCronJobs() {
  console.log("start jobs");
  
  // Daily scans
  const axios = require('axios');
  const { analyzeWebsite } = require('./broken-link-checker');
  const Domain = require('../models/Domain');
  const CronJob = require('cron').CronJob;

  

  function startCronJobs() {
    console.log("startcron func");
  
    new CronJob('25 15 * * *', async () => {
      console.log('Starting daily scan job...');
      try {
        const users = await User.find({});  // Get all users
        console.log(users,"users");
        
        
      for (const user of users) {
        // Fetch domains scheduled for daily scan for each user
        const domains = await Domain.find({ userId: user._id, schedule: 'daily' });

        // Process each domain for the user
        for (const domain of domains) {
          console.log(`Scanning domain ${domain.url} for user ${user.email}`);
          console.log(`Starting scan for ${domain.url}`);
          await analyzeWebsite(domain.url, user._id, domain._id);
          console.log(`Completed scan for ${domain.url}`);
        }
      }
      console.log('Daily scans completed for all users');
      } catch (error) {
        console.error('Daily scan error:', error.message);
      }
    }, null, true, 'Asia/Kolkata');

    console.log('Cron jobs initialized...');
    new CronJob('* * * * *', async () => {
      console.log('🔁 Cron test: job running every minute');
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
