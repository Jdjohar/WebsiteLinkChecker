const User = require('../models/User');
const nodemailer = require('nodemailer');

async function sendEmail(report, websiteUrl, userId) {
  console.log("userId:", userId);
  console.log("websiteUrl:", websiteUrl);

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const recipientList = [user.email, ...(user.extraEmails || [])];

  // Try the external Email API URL if defined
  if (process.env.EMAIL_API_URL) {
    try {
      const response = await fetch(process.env.EMAIL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          smtpHost: process.env.SMTP_HOST,
          smtpPort: process.env.SMTP_PORT,
          smtpUser: process.env.SMTP_USER,
          smtpPass: process.env.SMTP_PASS,
          from: process.env.SMTP_USER || process.env.EMAIL_FROM,
          to: user.email,
          bcc: user.extraEmails || [],
          subject: `Broken Links Report for ${websiteUrl}`,
          text: report.text,
          html: report.html
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Email API failed");
      }

      console.log("📬 Email API response:", data);
      console.log(`Email sent to: ${recipientList.join(", ")}`);
      return;
    } catch (error) {
      console.error(
        `❌ Error sending email via API for ${websiteUrl}:`,
        error.message
      );
      console.log("🔄 Falling back to nodemailer direct SMTP...");
    }
  }

  // Direct Nodemailer SMTP implementation
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_FROM,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_USER || process.env.EMAIL_FROM,
      to: user.email,          // visible recipient
      bcc: user.extraEmails || [],   // hidden recipients
      subject: `Broken Links Report for ${websiteUrl}`,
      text: report.text,
      html: report.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("📬 Email sent via nodemailer:", info.messageId);
    console.log(`Email sent to: ${recipientList.join(", ")}`);

  } catch (error) {
    console.error(
      `❌ Error sending email via nodemailer for ${websiteUrl}:`,
      error.message
    );
    throw new Error(`Failed to send email for ${websiteUrl}: ${error.message}`);
  }
}

module.exports = { sendEmail };

