import admin from '../config/firebase-admin.js';

const firebaseAuth = async (req, res, next) => {
  console.log('Verifying token...');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No auth token, access denied' });
    }

    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Add the verified user info to the request
    req.user = {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified
    };

    next();
  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ message: 'Token verification failed', error: err.message });
  }
};

export default firebaseAuth;