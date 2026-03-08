const User = require('../models/User');

async function sendEmail(report, websiteUrl, userId) {

  console.log("userId:", userId);
  console.log("websiteUrl:", websiteUrl);

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const recipientList = [user.email, ...(user.extraEmails || [])];

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
        from: process.env.SMTP_USER,
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

  } catch (error) {

    console.error(
      `❌ Error sending email for ${websiteUrl}:`,
      error.message
    );

    throw new Error(`Failed to send email for ${websiteUrl}`);
  }
}

module.exports = { sendEmail };
// const nodemailer = require('nodemailer');
// const User = require('../models/User');

// async function sendEmail(report, websiteUrl, userId) {
//   console.log("userId: ", userId);
//   console.log("report: ", report);
//   console.log("websiteUrl: ", websiteUrl);

//   const user = await User.findById(userId);
//   if (!user) {
//     throw new Error('User not found');
//   }

//   // Combine main email with extraEmails (if any)
//   const recipientList = [user.email, ...(user.extraEmails || [])];

//   const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//       user: process.env.EMAIL_FROM,
//       pass: process.env.EMAIL_PASSWORD,
//     },
//   });

//   // const mailOptions = {
//   //   from: process.env.EMAIL_FROM,
//   //   to: recipientList, // send to multiple
//   //   subject: `Broken Links Report for ${websiteUrl}`,
//   //   text: report.text,
//   //   html: report.html,
//   // };

//   const mailOptions = {
//   from: process.env.EMAIL_FROM,
//   to: user.email,          // visible recipient
//   bcc: user.extraEmails,   // hidden recipients
//   subject: `Broken Links Report for ${websiteUrl}`,
//   text: report.text,
//   html: report.html,
// };

//   try {
//     await transporter.sendMail(mailOptions);
//     console.log(`📬 Email sent to: ${recipientList.join(', ')}`);
//   } catch (error) {
//     console.error(`❌ Error sending email for ${websiteUrl}: ${error.message}`);
//     throw new Error(`Failed to send email for ${websiteUrl}`);
//   }
// }

// module.exports = { sendEmail };
