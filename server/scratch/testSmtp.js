import '../config/env.js';
import mongoose from 'mongoose';
import { sendContactNotification } from '../services/emailService.js';

async function testEmailDelivery() {
  console.log('--- TESTING EMAIL DELIVERY ---');
  await sendContactNotification({
    _id: new mongoose.Types.ObjectId(),
    name: 'Audit User',
    email: 'audit@example.com',
    subject: 'SMTP Diagnostics Test',
    message: 'Testing exact error codes.',
    createdAt: new Date()
  });

  // Give verification a moment to print async callbacks
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

testEmailDelivery();
