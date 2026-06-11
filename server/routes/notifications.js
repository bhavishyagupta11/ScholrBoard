import express from 'express';
import auth from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(auth);

// @route   GET /api/notifications
// @desc    Get user's notifications (with optional unreadOnly filter)
router.get('/', getMyNotifications);

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
router.put('/read-all', markAllAsRead);

// @route   PUT /api/notifications/:id/read
// @desc    Mark a specific notification as read
router.put('/:id/read', validateObjectId('id'), markAsRead);

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
router.delete('/:id', validateObjectId('id'), deleteNotification);

export default router;
