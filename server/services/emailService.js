/**
 * emailService.js — Nodemailer email service for ScholrBoard V2.
 *
 * Architecture:
 *   Fire-and-forget pattern — email failures NEVER block user submissions.
 *   All errors are caught and logged only. Callers receive no email error.
 *
 * Configuration (via environment variables — NO hardcoded credentials):
 *   EMAIL_USER          — SMTP username (e.g., your Gmail address)
 *   EMAIL_PASS          — SMTP password or App Password
 *   ADMIN_CONTACT_EMAIL — recipient for contact form notifications
 *
 * Usage:
 *   import { sendContactNotification } from './emailService.js';
 *   // Fire and forget — do NOT await in request handlers
 *   sendContactNotification(contactData).catch(() => {});
 */
import nodemailer from 'nodemailer';

// ─── Create transporter (lazy — only when needed) ─────────────────────────────

let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;

  console.log('[EmailService Diagnostics]', {
    EMAIL_USER_EXISTS: !!process.env.EMAIL_USER,
    EMAIL_PASS_EXISTS: !!process.env.EMAIL_PASS,
    ADMIN_CONTACT_EMAIL_EXISTS: !!process.env.ADMIN_CONTACT_EMAIL
  });

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[EmailService] EMAIL_USER or EMAIL_PASS not configured. Email sending disabled.');
    return null;
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',          // Change to your SMTP provider if needed
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Connection pool for performance
    pool: true,
    maxConnections: 3,
    rateDelta: 1000,
    rateLimit: 5,
  });

  _transporter.verify((error, success) => {
    if (error) {
      console.error('[EmailService] Transporter Verification Failed:', {
        code: error.code,
        command: error.command,
        message: error.message
      });
    } else {
      console.log('[EmailService] Transporter verified successfully, ready to send emails.');
    }
  });

  return _transporter;
};

// ─── Send contact form notification to admin ──────────────────────────────────

/**
 * sendContactNotification — Sends an email notification to ADMIN_CONTACT_EMAIL
 * when a new contact form submission is received.
 *
 * Fire-and-forget: errors are caught internally. Never throws.
 *
 * @param {Object} data - { name, email, subject, message, _id }
 */
export const sendContactNotification = async (data) => {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      console.info('[EmailService] Skipping email — transporter not configured.');
      return;
    }

    const adminEmail = process.env.ADMIN_CONTACT_EMAIL || 'pathbullish@gmail.com';

    const mailOptions = {
      from: `"ScholrBoard Support" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      replyTo: data.email,
      subject: `New Contact Form Submission - ScholrBoard`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 20px; border-radius: 6px 6px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">📬 New Contact Form Submission</h1>
          </div>
          <div style="padding: 24px; background: #f8fafc;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 100px;">Message ID:</td>
                <td style="padding: 8px 0; color: #1e293b;">${data._id}</td>
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
                <td style="padding: 8px 0; color: #1e293b;">${new Date(data.createdAt).toLocaleString()}</td>
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
      `,
      text: `New Contact Form Submission\n\nMessage ID: ${data._id}\nName: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\nSubmitted At: ${new Date(data.createdAt).toLocaleString()}\n\nMessage:\n${data.message}`,
    };

    await transporter.sendMail(mailOptions);
    console.info(`[EmailService] Contact notification sent successfully for submission ${data._id || 'N/A'}`);

  } catch (err) {
    // Log only — never propagate to caller
    console.error(`[EmailService] Failed to send contact notification:`, {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response
    });
  }
};

/**
 * sendTicketNotification — Sends email when a support ticket event occurs.
 * Optional — only fires if email is configured.
 *
 * @param {Object} data - { recipientEmail, recipientName, ticketNumber, eventType, message }
 */
export const sendTicketNotification = async (data) => {
  try {
    const transporter = getTransporter();
    if (!transporter) return;
    if (!data.recipientEmail) return;

    const eventLabels = {
      ticket_created:        '🎫 New Support Ticket Created',
      ticket_assigned:       '👤 Ticket Assigned to You',
      ticket_replied:        '💬 New Reply on Your Ticket',
      ticket_resolved:       '✅ Ticket Resolved',
      ticket_closed:         '🔒 Ticket Closed',
      ticket_status_changed: '🔄 Ticket Status Updated',
    };

    const label = eventLabels[data.eventType] || '📬 Ticket Update';

    const mailOptions = {
      from: `"ScholrBoard Support" <${process.env.EMAIL_USER}>`,
      to: data.recipientEmail,
      subject: `[${data.ticketNumber}] ${label}`,
      html: `
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
      `,
      text: `Hi ${data.recipientName || 'there'},\n\n${data.message}\n\nTicket: ${data.ticketNumber}\n\nPlease log in to ScholrBoard to view this ticket.`,
    };

    await transporter.sendMail(mailOptions);
    console.info(`[EmailService] Ticket notification (${data.eventType}) sent to ${data.recipientEmail}`);

  } catch (err) {
    console.error(`[EmailService] Failed to send ticket notification: ${err.message}`);
  }
};