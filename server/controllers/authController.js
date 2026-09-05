/**
 * authController.js — Native JWT Authentication business logic
 *
 * Auth flow (Native):
 *
 *   REGISTRATION:
 *     Client → POST /api/auth/register (with email, password, etc)
 *     Server → creates User + Profile documents in MongoDB (password hashed via pre-save hook)
 *     Server → issues server-signed JWT containing MongoDB _id + role
 *     Client → stores server JWT in localStorage
 *
 *   LOGIN:
 *     Client → POST /api/auth/login (with email and password)
 *     Server → finds existing User in MongoDB, verifies password
 *     Server → issues server-signed JWT
 *     Client → stores server JWT
 *
 *   SUBSEQUENT REQUESTS:
 *     Client → sends server JWT in Authorization header
 *     Server → auth.js middleware validates JWT
 *     Server → req.user contains { _id, role, department, email, ... }
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import { resolveTrackForDepartment } from '../utils/trackResolver.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Issue a signed server JWT.
 * Payload is intentionally minimal — just what middleware needs on every request.
 */
const issueServerJwt = (user) => {
  const payload = {
    userId:     user._id,
    _id:        user._id,
    email:      user.email,
    name:       user.name,
    role:       user.role,
    facultyLevel: user.facultyLevel || 'faculty',
    department: user.department || null,
    studentId:  user.studentId || null,
    facultyId:  user.facultyId || null,
    semester:   user.semester  || null,
    verified:   user.verified,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Build the safe user response object (no sensitive internals).
 */
const buildUserResponse = (user, token) => ({
  token,
  user: {
    _id:         user._id,
    name:        user.name,
    email:       user.email,
    role:        user.role,
    facultyLevel: user.facultyLevel || 'faculty',
    avatar:      user.avatar || null,
    department:  user.department || null,
    studentId:   user.studentId || null,
    facultyId:   user.facultyId || null,
    semester:    user.semester  || null,
    verified:    user.verified,
    trackId:     user.trackId   || null,
    createdAt:   user.createdAt,
  },
});

/**
 * Validate role-specific required fields.
 * Returns array of error strings (empty = valid).
 */
const validateRoleFields = (role, data) => {
  const errors = [];
  if (role === 'student') {
    if (!data.studentId)  errors.push('Student ID is required');
    if (!data.department) errors.push('Department is required');
    if (!data.semester || data.semester < 1 || data.semester > 8) {
      errors.push('A valid semester (1–8) is required');
    }
  } else if (role === 'faculty') {
    // faculty with facultyLevel=coordinator replaces old department_coordinator
    if (!data.facultyId)  errors.push('Faculty ID is required');
    if (!data.department) errors.push('Department is required');
  } else if (role !== 'admin') {
    errors.push(`Invalid role: "${role}". Must be student, faculty, or admin`);
  }
  return errors;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = async (req, res) => {
  try {
    const { email, password, name, studentId, department, semester } = req.body;
    const role = 'student';

    // --- Basic field validation ---
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, name',
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    const roleErrors = validateRoleFields(role, { studentId, department, semester });
    if (roleErrors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: roleErrors });
    }

    // --- Uniqueness checks ---
    const existingUser = await User.findOne({
      $or: [
        { email },
        ...(studentId ? [{ studentId }] : []),
      ],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(409).json({ success: false, message: 'Account already exists with this email' });
      }
      if (studentId && existingUser.studentId === studentId) {
        return res.status(409).json({ success: false, message: 'Student ID is already registered' });
      }
    }

    // --- Create User document ---
    const createData = {
      email,
      password,
      name:       name.trim(),
      role,
      department: department || undefined,
    };
    if (role === 'student') {
      createData.studentId = studentId;
      createData.semester = semester;
      createData.trackId = await resolveTrackForDepartment(department);
    }

    const user = await User.create(createData);
    await user.populate('trackId');

    // --- Auto-create an empty Profile document linked to the new user ---
    await Profile.create({ userId: user._id });

    // --- Issue server JWT ---
    const token = issueServerJwt(user);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      ...buildUserResponse(user, token),
    });
  } catch (error) {
    // Handle Mongoose validation errors cleanly
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: 'Validation error', errors: messages });
    }
    if (error.code === 11000) {
      // Duplicate key — shouldn't reach here after our uniqueness check, but just in case
      const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];
      return res.status(409).json({
        success: false,
        message: duplicateField
          ? `Duplicate value for ${duplicateField}. Please use a unique value.`
          : 'Duplicate identifier — please check your Student/Faculty ID',
      });
    }
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
};

/**
 * @desc    Login user using email and password
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password, portalRole } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Find user by email and explicitly select password
    const user = await User.findOne({ email }).select('+password').populate('trackId');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // V2.2: allowedRoles restricted. department_coordinator is gone.
    const allowedRoles = ['student', 'faculty', 'admin'];

    if (!portalRole) {
      return res.status(400).json({
        success: false,
        message: 'Portal role is required.',
      });
    }

    // portalRole must be one of the three portal-facing values
    const allowedPortalRoles = ['student', 'faculty', 'admin'];
    if (!allowedPortalRoles.includes(portalRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid portal role.',
      });
    }

    if (user.role !== portalRole) {
      return res.status(403).json({
        success: false,
        message: 'This account does not belong to the selected portal.',
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Account has been disabled."
      });
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save();

    const token = issueServerJwt(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      ...buildUserResponse(user, token),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

/**
 * @desc    Get current user's profile from JWT
 * @route   GET /api/auth/me
 * @access  Private — requires server JWT (auth middleware)
 *
 * Fast endpoint — re-fetches from DB to ensure fresh data (not just JWT payload).
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('trackId').select('-__v');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, user });
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch user data' });
  }
};

/**
 * @desc    Refresh the server JWT (e.g. after role change by admin)
 * @route   POST /api/auth/refresh
 * @access  Private — requires server JWT (auth middleware)
 */
export const refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('trackId');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }

    const token = issueServerJwt(user);
    return res.json({ success: true, token, user: buildUserResponse(user, token).user });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ success: false, message: 'Token refresh failed' });
  }
};

/**
 * @desc    Request password recovery email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (req, res) => {
  const genericSuccess = {
    success: true,
    message: 'If an account is associated with that email, a password reset link has been sent.',
  };

  try {
    const { email, portalRole } = req.body;

    if (!email || !portalRole) {
      return res.status(400).json({
        success: false,
        message: 'Email and portal role are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Portal role must strictly be 'student' or 'faculty'
    // Admin is completely excluded from self-service password recovery
    if (portalRole !== 'student' && portalRole !== 'faculty') {
      return res.status(200).json(genericSuccess);
    }

    const user = await User.findOne({ email: normalizedEmail, isActive: true });

    // Anti-enumeration: if user doesn't exist, is inactive, is admin, or does not match portal role,
    // silently return genericSuccess without issuing token or sending email
    if (!user || (user.role !== 'student' && user.role !== 'faculty') || user.role !== portalRole) {
      return res.status(200).json(genericSuccess);
    }

    // Generate 32-byte cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    // Store only SHA-256 hash in database
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15-minute expiration

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = expires;
    await user.save();

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const resetUrl = `${clientOrigin.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

    // Send email using existing emailService
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: 15,
    });

    return res.status(200).json(genericSuccess);
  } catch (error) {
    console.error('forgotPassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to process password reset request. Please try again later.',
    });
  }
};

/**
 * @desc    Reset password using recovery token
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    // Hash incoming token to match database hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with active token and unexpired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
      isActive: true,
    }).select('+password +resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This password reset link is invalid or has expired.',
      });
    }

    // Role verification: only student or faculty are eligible
    if (user.role !== 'student' && user.role !== 'faculty') {
      return res.status(400).json({
        success: false,
        message: 'This password reset link is invalid or has expired.',
      });
    }

    // Update password (will be bcrypt hashed by pre-save hook)
    user.password = password;
    // Invalidate token (single-use)
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('resetPassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password. Please try again later.',
    });
  }
};
