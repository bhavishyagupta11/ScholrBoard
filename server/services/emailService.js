/**
 * emailService.js — Resend HTTPS API email service for ScholrBoard V2.
 *
 * Architecture:
 *   - Primary provider: Resend HTTPS REST API (Port 443 — 100% Cloud / Render compatible).
 *   - Fire-and-forget pattern for contact and ticket notifications — failures never block user submissions.
 *   - Secure masked logging — never exposes raw email addresses or secrets to stdout.
 *
 * Configuration (via environment variables — NO hardcoded credentials):
 *   RESEND_API_KEY      — Resend API key (starts with 're_')
 *   FROM_EMAIL          — Sender email address (e.g., noreply@futuremedia.bullishpath.in or noreply@bullishpath.com)
 *   FROM_NAME           — Sender display name (default: "ScholrBoard")
 *   ADMIN_CONTACT_EMAIL — recipient for contact form notifications (default: pathbullish@gmail.com)
 */
import { Resend } from 'resend';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mask email or secret for safe logging
 */
const maskString = (str) => {
  if (!str || typeof str !== 'string') return '[NOT SET]';
  if (str.startsWith('re_')) return `re_${'*'.repeat(Math.max(4, str.length - 3))}`;
  if (str.includes('@')) {
    const [user, domain] = str.split('@');
    return `${user.substring(0, 2)}****@${domain}`;
  }
  return `${str.substring(0, 2)}${'*'.repeat(Math.max(4, str.length - 2))}`;
};

// ─── Resend Client Singleton ──────────────────────────────────────────────────

let _resendClient = null;

export const getResendClient = () => {
  if (_resendClient) return _resendClient;

  const apiKey = process.env.RESEND_API_KEY || (process.env.SMTP_PASS?.startsWith('re_') ? process.env.SMTP_PASS : null);

  if (!apiKey) {
    return null;
  }

  _resendClient = new Resend(apiKey);
  return _resendClient;
};

export const isEmailConfigured = () => {
  return !!(process.env.RESEND_API_KEY || (process.env.SMTP_PASS?.startsWith('re_')));
};

/**
 * Core sendEmail function using Resend HTTPS API
 *
 * @param {Object} options - { to, subject, html, text, from, replyTo }
 * @returns {Promise<{ delivered: boolean, messageId?: string, error?: string }>}
 */
export const sendEmail = async (options) => {
  const client = getResendClient();
  if (!client) {
    const errMessage = 'Resend client not configured (RESEND_API_KEY missing in environment).';
    console.warn(`[EmailService] ${errMessage}`);
    return { delivered: false, error: errMessage };
  }

  const fromName = process.env.FROM_NAME || 'ScholrBoard';
  const fromEmail = process.env.FROM_EMAIL || 'noreply@futuremedia.bullishpath.in';
  const fromHeader = options.from || `${fromName} <${fromEmail}>`;

  const toList = Array.isArray(options.to) ? options.to : [options.to];

  console.log('[EmailService] Outbound Email Trace:');
  console.log('  - Provider:   Resend HTTPS REST API (Port 443)');
  console.log('  - From:       %s', fromHeader);
  console.log('  - Recipient:  %s', maskString(toList[0]));
  console.log('  - Subject:    %s', options.subject);

  try {
    const payload = {
      from: fromHeader,
      to: toList,
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
    };

    const response = await client.emails.send(payload);

    if (response.error) {
      console.error('[EmailService] Resend HTTPS API delivery error:', response.error.message);
      return { delivered: false, error: response.error.message };
    }

    console.log('[EmailService] Email delivered successfully via Resend API (id: %s)', response.data?.id);
    return { delivered: true, provider: 'resend_api', messageId: response.data?.id };
  } catch (apiError) {
    console.error('[EmailService] Resend HTTPS API unexpected error:', apiError.message);
    return { delivered: false, error: apiError.message };
  }
};

// ─── Contact Form Notification ────────────────────────────────────────────────

/**
 * sendContactNotification — Sends an email notification to ADMIN_CONTACT_EMAIL
 * when a new contact form submission is received.
 *
 * Fire-and-forget: errors are caught internally. Never throws.
 *
 * @param {Object} data - { name, email, subject, message, _id, createdAt }
 */
export const sendContactNotification = async (data) => {
  try {
    if (!isEmailConfigured()) {
      console.info('[EmailService] Skipping contact notification — email service not configured.');
      return;
    }

    const adminEmail = process.env.ADMIN_CONTACT_EMAIL || 'pathbullish@gmail.com';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 20px; border-radius: 6px 6px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">📬 New Contact Form Submission</h1>
        </div>
        <div style="padding: 24px; background: #f8fafc;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 100px;">Message ID:</td>
              <td style="padding: 8px 0; color: #1e293b;">${data._id || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 100px;">Name:</td>
              <td style="padding: 8px 0; color: #1e293b;">${data.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Email:</td>
              <td style="padding: 8px 0; color: #1e293b;"><a href="mailto:${data.email}" style="color: #3b82f6;">${data.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Subject:</td>
              <td style="padding: 8px 0; color: #1e293b;">${data.subject}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Submitted At:</td>
              <td style="padding: 8px 0; color: #1e293b;">${new Date(data.createdAt || Date.now()).toLocaleString()}</td>
            </tr>
          </table>
          <div style="margin-top: 16px;">
            <div style="font-weight: bold; color: #475569; margin-bottom: 8px;">Message:</div>
            <div style="background: white; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0; color: #1e293b; white-space: pre-wrap;">${data.message}</div>
          </div>
        </div>
        <div style="padding: 12px 24px; background: #f1f5f9; border-radius: 0 0 6px 6px; font-size: 12px; color: #94a3b8; text-align: center;">
          This is an automated notification from ScholrBoard. Reply directly to this email to respond to the sender.
        </div>
      </div>
    `;

    const text = `New Contact Form Submission\n\nMessage ID: ${data._id || 'N/A'}\nName: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\nSubmitted At: ${new Date(data.createdAt || Date.now()).toLocaleString()}\n\nMessage:\n${data.message}`;

    await sendEmail({
      to: adminEmail,
      replyTo: data.email,
      subject: `New Contact Form Submission - ScholrBoard`,
      html,
      text,
    });
  } catch (err) {
    // Fire-and-forget: log only — never propagate to caller
    console.error(`[EmailService] Failed to send contact notification: ${err.message}`);
  }
};

// ─── Support Ticket Notification ──────────────────────────────────────────────

/**
 * sendTicketNotification — Sends email when a support ticket event occurs.
 * Optional — only fires if email is configured.
 *
 * @param {Object} data - { recipientEmail, recipientName, ticketNumber, eventType, message }
 */
export const sendTicketNotification = async (data) => {
  try {
    if (!isEmailConfigured() || !data.recipientEmail) return;

    const eventLabels = {
      ticket_created:        '🎫 New Support Ticket Created',
      ticket_assigned:       '👤 Ticket Assigned to You',
      ticket_replied:        '💬 New Reply on Your Ticket',
      ticket_resolved:       '✅ Ticket Resolved',
      ticket_closed:         '🔒 Ticket Closed',
      ticket_status_changed: '🔄 Ticket Status Updated',
    };

    const label = eventLabels[data.eventType] || '📬 Ticket Update';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 20px; border-radius: 6px 6px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${label}</h1>
        </div>
        <div style="padding: 24px; background: #f8fafc;">
          <p style="color: #1e293b;">Hi ${data.recipientName || 'there'},</p>
          <p style="color: #475569;">${data.message || 'There has been an update on your support ticket.'}</p>
          <div style="margin-top: 16px; padding: 12px; background: white; border-radius: 6px; border: 1px solid #e2e8f0;">
            <strong style="color: #475569;">Ticket:</strong> <span style="color: #3b82f6;">${data.ticketNumber}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">Please log in to ScholrBoard to view and respond to this ticket.</p>
        </div>
      </div>
    `;

    const text = `Hi ${data.recipientName || 'there'},\n\n${data.message}\n\nTicket: ${data.ticketNumber}\n\nPlease log in to ScholrBoard to view this ticket.`;

    await sendEmail({
      to: data.recipientEmail,
      subject: `[${data.ticketNumber}] ${label}`,
      html,
      text,
    });
  } catch (err) {
    console.error(`[EmailService] Failed to send ticket notification: ${err.message}`);
  }
};

// ─── Password Reset Email ─────────────────────────────────────────────────────

/**
 * sendPasswordResetEmail — Sends password recovery email with reset link via Resend HTTPS API.
 *
 * @param {Object} data - { to, name, resetUrl, expiresInMinutes }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
export const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresInMinutes = 15 }) => {
  try {
    console.log('[PASSWORD RESET] Email send attempt started');

    const client = getResendClient();
    if (!client) {
      console.warn('[PASSWORD RESET] Email send failed: Resend client not configured (RESEND_API_KEY missing in environment)');
      return { success: false, error: 'RESEND_NOT_CONFIGURED' };
    }

    if (!to || !resetUrl) {
      console.warn('[PASSWORD RESET] Email send failed: Missing recipient email or reset URL');
      return { success: false, error: 'MISSING_PARAMETERS' };
    }

    const fromName = process.env.FROM_NAME || 'ScholrBoard';
    const fromEmail = process.env.FROM_EMAIL || 'noreply@futuremedia.bullishpath.in';
    const from = `${fromName} <${fromEmail}>`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 20px; border-radius: 6px 6px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">🔒 Password Reset Request</h1>
        </div>
        <div style="padding: 24px; background: #f8fafc;">
          <p style="color: #1e293b; font-size: 15px; margin-top: 0;">Hi ${name || 'there'},</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">
            Someone requested a password reset for your ScholrBoard account. If this was you, use the button below to create a new password.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.4;">
            This link expires in <strong>${expiresInMinutes} minutes</strong>.
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; line-height: 1.4;">
            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
        </div>
        <div style="padding: 12px 24px; background: #f1f5f9; border-radius: 0 0 6px 6px; font-size: 12px; color: #94a3b8; text-align: center;">
          ScholrBoard Platform Security
        </div>
      </div>
    `;

    const text = `Hi ${name || 'there'},\n\nSomeone requested a password reset for your ScholrBoard account. If this was you, use the link below to create a new password:\n\n${resetUrl}\n\nThis link expires in ${expiresInMinutes} minutes.\n\nIf you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.`;

    const response = await client.emails.send({
      from,
      to: [to],
      subject: 'Password Reset Request - ScholrBoard',
      html,
      text,
    });

    if (response.error) {
      console.error(`[PASSWORD RESET] Resend request failed: ${response.error.message}`);
      return { success: false, error: response.error.message };
    }

    console.log(`[PASSWORD RESET] Resend request succeeded (id: ${response.data?.id || 'sent'})`);
    return { success: true, messageId: response.data?.id };
  } catch (err) {
    console.error(`[PASSWORD RESET] Resend request failed: ${err.message}`);
    return { success: false, error: err.message };
  }
};