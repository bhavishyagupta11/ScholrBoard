import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  // Load the service account key JSON file
  const serviceAccount = require('../firebase-service-account.json');

  // Replace escaped newline characters in the private key if necessary
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  if (!admin.apps.length) {
    // Initialize Firebase Admin only if it hasn't been initialized
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "codevengers-4c036"
    });
    console.log('Firebase Admin SDK initialized successfully');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  // In development, use a dummy admin instance
  if (process.env.NODE_ENV !== 'production') {
    console.log('Using development mode without Firebase Admin');
  } else {
    throw error;
  }
}

export default admin;