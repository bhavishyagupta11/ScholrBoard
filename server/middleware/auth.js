/**
 * auth.js — JWT verification middleware
 *
 * Verifies the JWT that the server issues after a successful Firebase sync.
 * This token is short-lived (7d) and contains the MongoDB user _id and role.
 *
 * Flow:
 *   1. Client Firebase-authenticates → sends Firebase ID token to /api/auth/sync
 *   2. Backend verifies Firebase token → issues its own JWT → client stores it
 *   3. All subsequent protected API calls send the server JWT in Authorization header
 *
 * Why two tokens?
 *   Firebase tokens expire in 1 hour and carry Firebase-specific claims.
 *   Our server JWT carries our own payload (MongoDB _id, role, department)
 *   and avoids repeated Firebase Admin SDK calls on every request.
 *
 * Security:
 *   - No fallback / bypass in any environment
 *   - JWT_SECRET must be set in environment variables (server fails to start if missing)
 *   - Token expiry is enforced strictly
 */
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied — no token provided',
    });
  }

  const token = authHeader.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied — malformed authorization header',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded._id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is unavailable or deactivated',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // Always use current database authorization state, never stale JWT claims.
    req.user = user;
    return next();
  } catch (err) {
    // Be specific about the error type for better client-side handling
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired — please log in again',
        code: 'TOKEN_EXPIRED',
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'TOKEN_INVALID',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token verification failed',
    });
  }
};

export default auth;
