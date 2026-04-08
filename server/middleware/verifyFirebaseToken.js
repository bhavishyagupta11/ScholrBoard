import admin from '../config/firebase-admin.js';

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    console.log('Verifying token...');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ 
      message: 'Invalid token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Token verification failed'
    });
  }
};