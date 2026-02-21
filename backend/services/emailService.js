const { transporter, emailTemplates } = require('../config/nodemailer');
const crypto = require('crypto');

// In-memory OTP storage (for production, use Redis)
const otpStore = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Store OTP with 10-minute expiry
const storeOTP = (email, otp) => {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  otpStore.set(email.toLowerCase(), { otp, expiresAt });
  
  // Auto-cleanup after expiry
  setTimeout(() => {
    otpStore.delete(email.toLowerCase());
  }, 10 * 60 * 1000);
};

// Verify OTP
const verifyOTP = (email, otp) => {
  const stored = otpStore.get(email.toLowerCase());
  
  if (!stored) {
    return { valid: false, message: 'OTP not found or expired' };
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return { valid: false, message: 'OTP expired' };
  }

  if (stored.otp !== otp) {
    return { valid: false, message: 'Invalid OTP' };
  }

  // OTP is valid, delete it
  otpStore.delete(email.toLowerCase());
  return { valid: true, message: 'OTP verified successfully' };
};

// Send password reset OTP
const sendPasswordResetOTP = async (email, recipientName) => {
  try {
    const otp = generateOTP();
    storeOTP(email, otp);

    const template = emailTemplates.passwordResetOTP(recipientName, otp);

    await transporter.sendMail({
      from: `"AlphaKnowledge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html
    });

    return { success: true, message: 'OTP sent successfully' };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, message: 'Failed to send OTP email', error: error.message };
  }
};

// Send batch expiry warning (7 days before)
const sendBatchExpiryWarning = async (adminEmails, instructorEmails, batchName, expiryDate, studentCount) => {
  try {
    const formattedDate = new Date(expiryDate).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const template = emailTemplates.batchExpiryWarning(batchName, formattedDate, studentCount);

    const recipients = [...adminEmails, ...instructorEmails];

    await transporter.sendMail({
      from: `"AlphaKnowledge" <${process.env.EMAIL_USER}>`,
      to: recipients.join(', '),
      subject: template.subject,
      html: template.html
    });

    return { success: true, message: 'Batch expiry warning sent successfully' };
  } catch (error) {
    console.error('Error sending batch expiry warning:', error);
    return { success: false, message: 'Failed to send batch expiry warning', error: error.message };
  }
};

// Send welcome email to new users
const sendWelcomeEmail = async (email, userName, tempPassword, role) => {
  try {
    const template = emailTemplates.welcomeEmail(userName, email, tempPassword, role);

    await transporter.sendMail({
      from: `"AlphaKnowledge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: template.html
    });

    return { success: true, message: 'Welcome email sent successfully' };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, message: 'Failed to send welcome email', error: error.message };
  }
};

// Send bulk welcome emails (for CSV import)
const sendBulkWelcomeEmails = async (users) => {
  const results = [];

  for (const user of users) {
    const result = await sendWelcomeEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      user.tempPassword,
      user.role
    );
    results.push({ email: user.email, ...result });
  }

  return results;
};

// Send password change confirmation
const sendPasswordChangeConfirmation = async (email, userName) => {
  try {
    await transporter.sendMail({
      from: `"AlphaKnowledge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'AlphaKnowledge - Password Changed Successfully',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Changed</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${userName}</strong>,</p>
              <p>Your AlphaKnowledge account password has been changed successfully.</p>
              <p>If you did not make this change, please contact your administrator immediately.</p>
              <p>Login URL: <a href="${process.env.FRONTEND_URL}/login">${process.env.FRONTEND_URL}/login</a></p>
            </div>
            <div class="footer">
              <p>© 2026 AlphaKnowledge. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    return { success: true, message: 'Password change confirmation sent' };
  } catch (error) {
    console.error('Error sending password change confirmation:', error);
    return { success: false, message: 'Failed to send confirmation email' };
  }
};

// Send profile reset notification (plagiarism handling)
const sendProfileResetNotification = async (email, userName, resetByName) => {
  try {
    await transporter.sendMail({
      from: `"AlphaKnowledge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'AlphaKnowledge - Profile Reset Notification',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Profile Reset</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${userName}</strong>,</p>
              <div class="warning">
                <strong>Your AlphaKnowledge profile has been reset by ${resetByName}.</strong>
              </div>
              <p>All your data has been permanently deleted, including:</p>
              <ul>
                <li>All problem submissions</li>
                <li>Progress tracking</li>
                <li>External profile links</li>
                <li>Contest submissions</li>
                <li>Leaderboard entries</li>
              </ul>
              <p>This action was taken due to policy violations. If you have questions, please contact your instructor or administrator.</p>
            </div>
            <div class="footer">
              <p>© 2026 AlphaKnowledge. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    return { success: true, message: 'Profile reset notification sent' };
  } catch (error) {
    console.error('Error sending profile reset notification:', error);
    return { success: false, message: 'Failed to send notification' };
  }
};

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendPasswordResetOTP,
  sendBatchExpiryWarning,
  sendWelcomeEmail,
  sendBulkWelcomeEmails,
  sendPasswordChangeConfirmation,
  sendProfileResetNotification
};
