import Announcement from '../models/Announcement.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { withTransaction } from '../utils/withTransaction.js';

// ─── ADMIN: Create Announcement & Notify targeted users ───────────────────────
export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, category, filters } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: title, content, category',
      });
    }

    const userQuery = { isActive: true };
    
    if (filters?.department) {
      userQuery.department = new RegExp(`^${filters.department}$`, 'i');
    }
    
    if (filters?.year) {
      // Academic year maps to semesters (Year 1: Sem 1, 2; Year 2: Sem 3, 4; Year 3: Sem 5, 6; Year 4: Sem 7, 8)
      const semStart = filters.year * 2 - 1;
      const semEnd = filters.year * 2;
      userQuery.semester = { $in: [semStart, semEnd] };
    }

    if (filters?.role && filters.role !== 'all') {
      userQuery.role = filters.role;
    }

    const matchedUsers = await User.find(userQuery).select('_id');

    const announcement = await withTransaction(async (session) => {
      const [created] = await Announcement.create([{
        title: title.trim(),
        content: content.trim(),
        category,
        filters: filters || {},
        postedBy: req.user._id,
      }], { session });

      const notificationDocs = matchedUsers.map((user) => ({
        userId: user._id,
        title: `New ${category} Announcement`,
        message: `${title}: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`,
        type: 'announcement',
        relatedId: created._id,
        relatedModel: 'Announcement',
        actionUrl: '/student/dashboard',
        priority: 'medium',
      }));

      if (notificationDocs.length > 0) {
        await Notification.insertMany(notificationDocs, { session });
      }

      return created;
    });

    return res.status(201).json({
      success: true,
      message: `Announcement posted successfully and sent to ${matchedUsers.length} users`,
      announcement,
    });
  } catch (error) {
    console.error('createAnnouncement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
};

// ─── ALL ROLES: Fetch targeted announcements for Dashboard ────────────────────
export const getMyAnnouncements = async (req, res) => {
  try {
    const role = req.user.role;
    const department = req.user.department;
    const semester = req.user.semester;
    const year = semester ? Math.ceil(semester / 2) : null;

    // Build matching query conditions:
    // 1. Role matches user role OR target all roles
    // 2. Department matches user department OR target all departments
    // 3. Year matches user academic year OR target all years
    const query = {
      $and: [
        {
          $or: [
            { 'filters.role': 'all' },
            { 'filters.role': role },
          ],
        },
        {
          $or: [
            { 'filters.department': null },
            { 'filters.department': new RegExp(`^${department}$`, 'i') },
          ],
        },
        {
          $or: [
            { 'filters.year': null },
            { 'filters.year': year },
          ],
        },
      ],
    };

    const announcements = await Announcement.find(query)
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json({ success: true, announcements });
  } catch (error) {
    console.error('getMyAnnouncements error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
};

// ─── ADMIN: Delete Announcement ────────────────────────────────────────────────
export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    
    // Clean up related notifications
    await Notification.deleteMany({ relatedId: req.params.id, relatedModel: 'Announcement' });

    return res.json({ success: true, message: 'Announcement removed' });
  } catch (error) {
    console.error('deleteAnnouncement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete announcement' });
  }
};
