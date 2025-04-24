const nodemailer = require('nodemailer');
const User = require('../models/User');

async function sendEmail(report, websiteUrl, userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `Broken Links Report for ${websiteUrl}`,
    text: report.text,
    html: report.html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully for ${websiteUrl} to ${user.email}`);
  } catch (error) {
    console.error(`Error sending email for ${websiteUrl}: ${error.message}`);
    throw new Error(`Failed to send email for ${websiteUrl}`);
  }
}

module.exports = { sendEmail };