/**
 * server/scripts/verify-resend.js
 * Tool to verify Resend API connectivity, inspect verified domains,
 * and test email delivery over HTTPS REST API (Port 443) without exposing credentials.
 *
 * Usage:
 *   node server/scripts/verify-resend.js [optional-recipient-email]
 */
import '../config/env.js';
import { Resend } from 'resend';
import { sendPasswordResetEmail } from '../services/emailService.js';

const maskString = (str) => {
  if (!str || typeof str !== 'string') return '[NOT SET]';
  if (str.startsWith('re_')) return `re_${'*'.repeat(Math.max(4, str.length - 3))}`;
  if (str.includes('@')) {
    const [user, domain] = str.split('@');
    return `${user.substring(0, 2)}****@${domain}`;
  }
  return `${str.substring(0, 2)}${'*'.repeat(Math.max(4, str.length - 2))}`;
};

async function verifyResend() {
  console.log('\n==================================================');
  console.log('       SCHOLRBOARD RESEND DIAGNOSTIC TOOL         ');
  console.log('==================================================\n');

  const apiKey = process.env.RESEND_API_KEY || (process.env.SMTP_PASS?.startsWith('re_') ? process.env.SMTP_PASS : null);
  const fromEmail = process.env.FROM_EMAIL || 'noreply@futuremedia.bullishpath.in';
  const fromName = process.env.FROM_NAME || 'ScholrBoard';
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  console.log('Environment Variables Check:');
  console.log(`- RESEND_API_KEY: ${maskString(apiKey)}`);
  console.log(`- FROM_EMAIL:     ${fromEmail}`);
  console.log(`- FROM_NAME:      ${fromName}`);
  console.log(`- CLIENT_ORIGIN:  ${clientOrigin}`);

  if (!apiKey) {
    console.error('\n[ERROR] RESEND_API_KEY is missing in environment variables.');
    console.error('If running on Render, ensure RESEND_API_KEY is set in Render Dashboard -> Environment.');
    process.exit(1);
  }

  const resend = new Resend(apiKey);

  console.log('\nQuerying Resend API for verified domains...');
  try {
    const domainsResponse = await resend.domains.list();
    if (domainsResponse.error) {
      console.error('[ERROR] Failed to list domains from Resend:', domainsResponse.error.message);
    } else {
      const domains = domainsResponse.data?.data || [];
      console.log(`[SUCCESS] Resend API authenticated! Found ${domains.length} domain(s):`);
      domains.forEach((d) => {
        console.log(`  - Domain: ${d.name} | Status: ${d.status} | Region: ${d.region}`);
      });
    }
  } catch (err) {
    console.error('[ERROR] Resend API connectivity error:', err.message);
    process.exit(1);
  }

  const recipient = process.argv[2];
  if (recipient) {
    console.log(`\nSending test password-reset recovery email to: ${maskString(recipient)}...`);
    try {
      const resetUrl = `${clientOrigin.replace(/\/$/, '')}/reset-password?token=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`;
      const result = await sendPasswordResetEmail({
        to: recipient,
        name: 'ScholrBoard User',
        resetUrl,
        expiresInMinutes: 15,
      });

      if (result.success) {
        console.log(`[SUCCESS] Password reset email delivered successfully via Resend API!`);
        console.log(`  - Resend Email ID: ${result.messageId}`);
      } else {
        console.error(`[ERROR] Email sending failed: ${result.error}`);
        process.exit(1);
      }
    } catch (err) {
      console.error('[ERROR] Unexpected error sending email:', err.message);
      process.exit(1);
    }
  } else {
    console.log('\n(No recipient passed. To test live delivery, run: node server/scripts/verify-resend.js <recipient-email>)');
  }

  console.log('\n==================================================\n');
  process.exit(0);
}

verifyResend().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
