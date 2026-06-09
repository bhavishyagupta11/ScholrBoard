/**
 * roleAuth.js — Role-based access control middleware factory
 *
 * Usage:
 *   router.get('/admin-only-route', auth, requireRole('admin'), handler);
 *   router.post('/faculty-or-admin', auth, requireRole('faculty', 'admin'), handler);
 *
 * Must be used AFTER the `auth` middleware so req.user is populated.
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied — requires role: ${allowedRoles.join(' or ')}`,
        yourRole: req.user.role,
      });
    }

    return next();
  };
};

export default requireRole;