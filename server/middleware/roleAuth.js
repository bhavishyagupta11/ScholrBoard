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

    const userRole = req.user.role;
    const isAllowed = allowedRoles.includes(userRole);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: `Access denied — requires role: ${allowedRoles.join(' or ')}`,
        yourRole: userRole,
      });
    }

    return next();
  };
};

export default requireRole;