/**
 * server/scripts/verify-smtp.js
 * Tool to verify SMTP transporter connectivity and test email delivery without exposing credentials.
 * Usage:
 *   node server/scripts/verify-smtp.js [optional-recipient-email]
 */
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import '../config/env.js';
import nodemailer from 'nodemailer';

async function verifySmtp() {
  console.log('\n==================================================');
  console.log('       SCHOLRBOARD SMTP DIAGNOSTIC TOOL           ');
  console.log('==================================================\n');

  const emailUser = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : null;
  const emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : null;
  const clientOrigin = process.env.CLIENT_ORIGIN || '(not set, defaults to http://localhost:5173)';

  console.log('Environment Variables Check:');
  console.log(`- EMAIL_USER:     ${emailUser ? 'Configured (' + emailUser.replace(/(.{2})(.*)(@.*)/, '$1***$3') + ')' : 'MISSING'}`);
  console.log(`- EMAIL_PASS:     ${emailPass ? 'Configured (length: ' + emailPass.length + ' chars)' : 'MISSING'}`);
  console.log(`- CLIENT_ORIGIN:  ${clientOrigin}`);

  if (!emailUser || !emailPass) {
    console.error('\n[ERROR] EMAIL_USER or EMAIL_PASS is missing in environment variables.');
    console.error('If running on Render, ensure EMAIL_USER and EMAIL_PASS are set in Render Dashboard -> Environment.');
    process.exit(1);
  }

  console.log('\nInitializing Nodemailer Gmail Transporter...');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    pool: true,
    maxConnections: 3,
  });

  console.log('Testing SMTP connection with Gmail...');
  try {
    await transporter.verify();
    console.log('[SUCCESS] SMTP Transporter verified successfully! Authentication and connection to Gmail succeeded.');
  } catch (err) {
    console.error('[ERROR] SMTP Transporter verification failed:', {
      code: err.code,
      command: err.command,
      message: err.message,
    });
    console.error('\nTroubleshooting tips:');
    console.error('1. For Gmail, you MUST use a Google App Password (16 characters, no spaces), not your account password.');
    console.error('2. Ensure 2-Step Verification is enabled on the sending Google account.');
    console.error('3. Check that the sending account is not locked or requiring a CAPTCHA challenge.');
    process.exit(1);
  }

  const recipient = process.argv[2];
  if (recipient) {
    console.log(`\nSending diagnostic test email to: ${recipient}...`);
    try {
      const info = await transporter.sendMail({
        from: `"ScholrBoard Security" <${emailUser}>`,
        to: recipient,
        subject: 'ScholrBoard SMTP Diagnostic Test',
        text: 'This is a diagnostic test email verifying that ScholrBoard SMTP email sending is functioning properly.',
        html: '<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #3b82f6; border-radius: 8px;"><h2 style="color: #3b82f6;">ScholrBoard SMTP Diagnostic Test</h2><p>This email confirms that the ScholrBoard SMTP email service is functioning properly.</p></div>',
      });
      console.log(`[SUCCESS] Test email delivered successfully (messageId: ${info.messageId})`);
    } catch (err) {
      console.error('[ERROR] Failed to send test email:', err.message);
      process.exit(1);
    }
  } else {
    console.log('\n(No recipient passed. To send a test email, run: node server/scripts/verify-smtp.js <recipient-email>)');
  }

  console.log('\n==================================================\n');
  process.exit(0);
}

verifySmtp().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
