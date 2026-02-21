const nodemailer = require('nodemailer');

// Email Configuration
const emailConfig = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
};

// Create reusable transporter
const transporter = nodemailer.createTransport({
    service: emailConfig.service,
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.auth,
    tls: {
        rejectUnauthorized: false
    }
});

// Verify transporter configuration
const verifyEmailConfig = async () => {
    try {
        await transporter.verify();
        console.log('✅ Email service is ready to send messages');
        return true;
    } catch (error) {
        console.error('❌ Email configuration error:', error.message);
        return false;
    }
};

// Email Templates
const emailTemplates = {
    // OTP Email for Password Reset (6-digit, 10-min expiry)
    passwordResetOTP: (recipientName, otp) => ({
        subject: 'AlphaKnowledge - Password Reset OTP',
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 AlphaKnowledge Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${recipientName}</strong>,</p>
            <p>We received a request to reset your AlphaKnowledge account password. Use the OTP below to proceed:</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #666; font-size: 14px;">Your One-Time Password</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">Valid for 10 minutes</p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your account remains secure.
            </div>
            
            <p>This OTP will expire in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
          </div>
          <div class="footer">
            <p>© 2026 AlphaKnowledge. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
    }),

    // Batch Expiry Warning (7 days before)
    batchExpiryWarning: (batchName, expiryDate, studentCount) => ({
        subject: `AlphaKnowledge - Batch Expiry Warning: ${batchName}`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-box { background: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .stats { background: white; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Batch Expiry Warning</h1>
          </div>
          <div class="content">
            <div class="alert-box">
              <h2 style="margin-top: 0; color: #856404;">Action Required</h2>
              <p><strong>Batch:</strong> ${batchName}</p>
              <p><strong>Expiry Date:</strong> ${expiryDate}</p>
              <p><strong>Days Remaining:</strong> 7 days</p>
            </div>
            
            <p>This batch will be automatically deleted on <strong>${expiryDate}</strong>. All associated data will be permanently removed:</p>
            
            <div class="stats">
              <h3>Data to be Deleted:</h3>
              <ul>
                <li><strong>${studentCount}</strong> student accounts (hard delete)</li>
                <li>All student submissions and progress</li>
                <li>All external profile links and contest history</li>
                <li>All internal contest data</li>
              </ul>
            </div>
            
            <p><strong>⚠️ This is a HARD DELETE - data cannot be recovered after deletion.</strong></p>
            
            <p>If you need to extend this batch, please log in to the admin dashboard and manually extend the batch expiry date.</p>
          </div>
          <div class="footer">
            <p>© 2026 AlphaKnowledge. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
    }),

    // Welcome Email for New Users
    welcomeEmail: (userName, email, tempPassword, role) => ({
        subject: 'Welcome to AlphaKnowledge - Your Account is Ready!',
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Welcome to AlphaKnowledge!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>Your AlphaKnowledge account has been created successfully. You can now access the platform with the following credentials:</p>
            
            <div class="credentials">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 4px;">${tempPassword}</code></p>
              <p><strong>Role:</strong> ${role.toUpperCase()}</p>
            </div>
            
            <p><strong>🔒 Important:</strong> Please change your password after your first login for security purposes.</p>
            
            <p>Login URL: <a href="${process.env.FRONTEND_URL}/login">${process.env.FRONTEND_URL}/login</a></p>
          </div>
          <div class="footer">
            <p>© 2026 AlphaKnowledge. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
    })
};

module.exports = {
    transporter,
    verifyEmailConfig,
    emailTemplates,
    emailConfig
};
