import User from '../models/User.js';
import admin from '../config/firebase-admin.js';

// Validate role-specific fields
const validateRoleFields = (role, data) => {
  const errors = [];

  switch (role) {
    case 'student':
      if (!data.studentId) errors.push('Student ID is required');
      if (!data.department) errors.push('Department is required');
      if (!data.semester || data.semester < 1 || data.semester > 8) {
        errors.push('Valid semester (1-8) is required');
      }
      break;
    case 'faculty':
      if (!data.facultyId) errors.push('Faculty ID is required');
      if (!data.department) errors.push('Department is required');
      break;
    case 'admin':
      // Add any admin-specific validation here
      break;
    default:
      errors.push('Invalid role specified');
  }

  return errors;
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    console.log('Register request body:', req.body);
    console.log('User from token:', req.user);

    const { 
      firebaseUid,
      name, 
      email,
      role,
      studentId,
      facultyId,
      department,
      semester
    } = req.body;

    // Verify we have all required fields
    if (!firebaseUid || !name || !email || !role) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['firebaseUid', 'name', 'email', 'role'],
        received: req.body 
      });
    }

    // Verify the Firebase token
    console.log('Token verification:', {
      userFromToken: req.user,
      providedUid: firebaseUid,
      providedEmail: email
    });

    // In development, allow the registration if email matches
    if (process.env.NODE_ENV !== 'production') {
      if (req.user.email === email) {
        console.log('Development mode: Allowing registration with matching email');
      } else {
        console.log('Development mode: Email mismatch');
        return res.status(401).json({
          message: 'Unauthorized - Email mismatch',
          userFromToken: req.user.email,
          providedEmail: email
        });
      }
    } else {
      // In production, strictly verify Firebase UID
      if (!req.user || req.user.firebaseUid !== firebaseUid) {
        return res.status(401).json({ 
          message: 'Unauthorized - Token mismatch',
          userFromToken: req.user?.firebaseUid,
          providedUid: firebaseUid
        });
      }
    }

    // Check if user exists in MongoDB
    const userExists = await User.findOne({ firebaseUid });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Validate role-specific fields
    const roleErrors = validateRoleFields(role, {
      studentId,
      facultyId,
      department,
      semester
    });

    if (roleErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: roleErrors 
      });
    }

    // Check if studentId/facultyId already exists
    if (role === 'student' && await User.findOne({ studentId })) {
      return res.status(400).json({ message: 'Student ID already exists' });
    }
    if (role === 'faculty' && await User.findOne({ facultyId })) {
      return res.status(400).json({ message: 'Faculty ID already exists' });
    }

    // Create user in MongoDB
    const user = await User.create({
      firebaseUid,
      name,
      email,
      role,
      studentId,
      facultyId,
      department,
      semester
    });

    res.status(201).json({
      _id: user._id,
      firebaseUid: user.firebaseUid,
      name: user.name,
      email: user.email,
      role: user.role,
      ...(user.studentId && { studentId: user.studentId }),
      ...(user.facultyId && { facultyId: user.facultyId }),
      department: user.department,
      ...(user.semester && { semester: user.semester })
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Sync user data after Firebase authentication
// @route   POST /api/auth/sync
// @access  Private
export const syncUserData = async (req, res) => {
  try {
    // Find user by Firebase UID
    const user = await User.findOne({ firebaseUid: req.user.firebaseUid });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user data
    res.json({
      _id: user._id,
      firebaseUid: user.firebaseUid,
      name: user.name,
      email: user.email,
      role: user.role,
      ...(user.studentId && { studentId: user.studentId }),
      ...(user.facultyId && { facultyId: user.facultyId }),
      department: user.department,
      ...(user.semester && { semester: user.semester })
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(user.studentId && { studentId: user.studentId }),
        ...(user.facultyId && { facultyId: user.facultyId }),
        department: user.department,
        ...(user.semester && { semester: user.semester }),
        createdAt: user.createdAt
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};