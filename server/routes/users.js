/**
 * users.js — User management routes (admin use)
 */
import express from 'express';
import auth from '../middleware/auth.js';
import requireRole from '../middleware/roleAuth.js';
import User from '../models/User.js';

const router = express.Router();

router.use(auth);

// @route   GET /api/users
// @desc    Get all users (with filtering by role/department)
// @access  Admin or Faculty
router.get('/', requireRole('admin', 'faculty'), async (req, res) => {
  try {
    const { role, department, verified, page = 1, limit = 50 } = req.query;

    const query = { isActive: true };
    
    if (req.user.role === 'faculty') {
      query.role = 'student';
      if (req.user.department) query.department = new RegExp(`^${req.user.department}$`, 'i');
    } else {
      if (role)       query.role       = role;
      if (department) query.department = new RegExp(department, 'i');
    }
    
    if (verified !== undefined) query.verified = verified === 'true';

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-__v -password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    return res.json({
      success: true,
      users,
      pagination: {
        currentPage: Number(page),
        totalPages:  Math.ceil(total / Number(limit)),
        totalUsers:  total,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching users' });
  }
});

// @route   GET /api/users/me
// @desc    Get current user (quick route — same as /api/auth/me)
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-__v -password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by MongoDB _id, studentId, or facultyId
// @access  Admin or Faculty (own department only for faculty)
router.get('/:id', requireRole('admin', 'faculty'), async (req, res) => {
  try {
    const { id } = req.params;
    let user = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(id).select('-__v -password');
    }

    if (!user) {
      user = await User.findOne({
        $or: [{ studentId: id }, { facultyId: id }],
      }).select('-__v -password');
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Faculty can only view users from their own department
    if (req.user.role === 'faculty' && user.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user (admin only — for role changes, verification, etc.)
// @access  Admin only
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Prevent escalating privileges or tampering with auth identifiers
    delete updates._id;
    delete updates.password;
    delete updates.email;
    delete updates.__v;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-__v -password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.json({ success: true, message: 'User updated', user });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating user' });
  }
});

// @route   DELETE /api/users/:id (soft-delete)
// @access  Admin only
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;