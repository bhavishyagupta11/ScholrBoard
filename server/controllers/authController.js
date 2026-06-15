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
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Profile from '../models/Profile.js';

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
    avatar:      user.avatar || null,
    department:  user.department || null,
    studentId:   user.studentId || null,
    facultyId:   user.facultyId || null,
    semester:    user.semester  || null,
    verified:    user.verified,
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
  } else if (role === 'faculty' || role === 'department_coordinator') {
    // V2: department_coordinator uses same field requirements as faculty
    if (!data.facultyId)  errors.push('Faculty ID is required');
    if (!data.department) errors.push('Department is required');
  } else if (role !== 'admin') {
    errors.push(`Invalid role: "${role}". Must be student, faculty, admin, or department_coordinator`);
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
    }

    const user = await User.create(createData);

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
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // V2: allowedRoles expanded to include department_coordinator.
    // department_coordinator users log in through the Faculty Portal
    // which sends portalRole='faculty'. They are validated below.
    const allowedRoles = ['student', 'faculty', 'admin', 'department_coordinator'];

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

    // V2: department_coordinator logs in via Faculty Portal (portalRole='faculty').
    // Allow this combination. All other mismatches are rejected.
    const isCoordinatorViaFacultyPortal =
      user.role === 'department_coordinator' && portalRole === 'faculty';

    if (!isCoordinatorViaFacultyPortal && user.role !== portalRole) {
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
    const user = await User.findById(req.user._id).select('-__v');
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
    const user = await User.findById(req.user._id);
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
