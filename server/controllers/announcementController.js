import Announcement from '../models/Announcement.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { withTransaction } from '../utils/withTransaction.js';

const escapeRegex = (val = '') => String(val).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeAnnouncementFilters = (raw = {}) => ({
  department: raw.department && String(raw.department).trim() ? String(raw.department).trim().toUpperCase() : null,
  year: raw.year ? Number(raw.year) : null,
  section: raw.section && String(raw.section).trim() ? String(raw.section).trim().toUpperCase() : null,
  role: ['student', 'faculty', 'all'].includes(raw.role) ? raw.role : 'all',
});

const buildTargetUserQuery = (normalizedFilters) => {
  const userQuery = { isActive: true };
  if (normalizedFilters.department) {
    userQuery.department = new RegExp(`^${escapeRegex(normalizedFilters.department)}$`, 'i');
  }
  if (normalizedFilters.year) {
    const semStart = normalizedFilters.year * 2 - 1;
    const semEnd = normalizedFilters.year * 2;
    userQuery.semester = { $in: [semStart, semEnd] };
  }
  if (normalizedFilters.section) {
    userQuery.section = new RegExp(`^${escapeRegex(normalizedFilters.section)}$`, 'i');
  }
  if (normalizedFilters.role && normalizedFilters.role !== 'all') {
    userQuery.role = normalizedFilters.role;
  }
  return userQuery;
};

// ─── ADMIN: Create Announcement (Published or Draft) & Notify targeted users ──
export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, category, filters, status = 'Published', expiresAt = null } = req.body;

    if (!title || !String(title).trim() || !content || !String(content).trim() || !category) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: title, content, category',
      });
    }

    if (!['Draft', 'Published'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be Draft or Published.',
      });
    }

    const normalizedFilters = normalizeAnnouncementFilters(filters || {});
    let parsedExpiresAt = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (Number.isNaN(parsedExpiresAt.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid expiration date' });
      }
    }

    const shouldNotify = status === 'Published';
    const matchedUsers = shouldNotify ? await User.find(buildTargetUserQuery(normalizedFilters)).select('_id') : [];

    const announcement = await withTransaction(async (session) => {
      const [created] = await Announcement.create([{
        title: String(title).trim(),
        content: String(content).trim(),
        category,
        filters: normalizedFilters,
        status,
        publishedAt: shouldNotify ? new Date() : null,
        expiresAt: parsedExpiresAt,
        postedBy: req.user._id,
      }], { session });

      if (shouldNotify && matchedUsers.length > 0) {
        const notificationDocs = matchedUsers.map((user) => ({
          userId: user._id,
          title: `New ${category} Announcement`,
          message: `${String(title).trim()}: ${String(content).trim().slice(0, 100)}${String(content).trim().length > 100 ? '...' : ''}`,
          type: 'announcement',
          relatedId: created._id,
          relatedModel: 'Announcement',
          actionUrl: '/student/dashboard',
          priority: 'medium',
        }));

        await Notification.insertMany(notificationDocs, { session });
      }

      return created;
    });

    const populated = await Announcement.findById(announcement._id).populate('postedBy', 'name email');

    return res.status(201).json({
      success: true,
      message: status === 'Published'
        ? `Announcement posted successfully and sent to ${matchedUsers.length} users`
        : 'Announcement saved as draft',
      announcement: populated || announcement,
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('createAnnouncement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
};

// ─── ADMIN: Fetch ALL announcements (Published + Draft) for Admin Management ───
export const getAllAnnouncements = async (req, res) => {
  try {
    const { status, category, search } = req.query;
    const query = {};

    if (status === 'Draft') {
      query.status = 'Draft';
    } else if (status === 'Published') {
      query.$or = [{ status: 'Published' }, { status: { $exists: false } }];
    }
    if (category) {
      query.category = category;
    }
    if (search && String(search).trim()) {
      const re = new RegExp(escapeRegex(String(search).trim()), 'i');
      query.$and = [...(query.$and || []), { $or: [{ title: re }, { content: re }] }];
    }

    const announcements = await Announcement.find(query)
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ success: true, announcements });
  } catch (error) {
    console.error('getAllAnnouncements error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch admin announcements' });
  }
};

// ─── ADMIN: Update / Publish / Edit an Announcement ───────────────────────────
export const updateAnnouncement = async (req, res) => {
  try {
    const existing = await Announcement.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const { title, content, category, filters, status, expiresAt } = req.body;
    const nextTitle = title !== undefined ? String(title).trim() : existing.title;
    const nextContent = content !== undefined ? String(content).trim() : existing.content;
    const nextCategory = category !== undefined ? category : existing.category;
    const nextStatus = status !== undefined ? status : (existing.status || 'Published');

    if (!nextTitle || !nextContent || !nextCategory) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing: title, content, category',
      });
    }
    if (!['Draft', 'Published'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be Draft or Published.' });
    }

    const nextFilters = filters !== undefined
      ? normalizeAnnouncementFilters(filters)
      : normalizeAnnouncementFilters(existing.filters || {});

    let nextExpiresAt = existing.expiresAt ?? null;
    if (expiresAt !== undefined) {
      if (!expiresAt) {
        nextExpiresAt = null;
      } else {
        const parsed = new Date(expiresAt);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid expiration date' });
        }
        nextExpiresAt = parsed;
      }
    }

    const wasDraft = existing.status === 'Draft';
    const becomingPublished = wasDraft && nextStatus === 'Published';
    const matchedUsers = becomingPublished
      ? await User.find(buildTargetUserQuery(nextFilters)).select('_id')
      : [];

    const updated = await withTransaction(async (session) => {
      existing.title = nextTitle;
      existing.content = nextContent;
      existing.category = nextCategory;
      existing.filters = nextFilters;
      existing.status = nextStatus;
      existing.expiresAt = nextExpiresAt;
      if (becomingPublished && !existing.publishedAt) {
        existing.publishedAt = new Date();
      }
      await existing.save({ session });

      if (becomingPublished && matchedUsers.length > 0) {
        const notificationDocs = matchedUsers.map((user) => ({
          userId: user._id,
          title: `New ${nextCategory} Announcement`,
          message: `${nextTitle}: ${nextContent.slice(0, 100)}${nextContent.length > 100 ? '...' : ''}`,
          type: 'announcement',
          relatedId: existing._id,
          relatedModel: 'Announcement',
          actionUrl: '/student/dashboard',
          priority: 'medium',
        }));
        await Notification.insertMany(notificationDocs, { session });
      }

      return existing;
    });

    const populated = await Announcement.findById(updated._id).populate('postedBy', 'name email');

    return res.json({
      success: true,
      message: becomingPublished
        ? `Notice published and sent to ${matchedUsers.length} users`
        : 'Announcement updated successfully',
      announcement: populated || updated,
    });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('updateAnnouncement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
};

// ─── ALL ROLES: Fetch targeted published announcements for Dashboard ──────────
export const getMyAnnouncements = async (req, res) => {
  try {
    const role = req.user.role;
    const department = req.user.department ? String(req.user.department).trim() : null;
    const semester = req.user.semester;
    const year = semester ? Math.ceil(semester / 2) : null;
    const section = req.user.section ? String(req.user.section).trim() : null;
    const now = new Date();

    const deptMatchConditions = [
      { 'filters.department': null },
      { 'filters.department': '' },
      { 'filters.department': { $exists: false } },
    ];
    if (department) {
      deptMatchConditions.push({ 'filters.department': new RegExp(`^${escapeRegex(department)}$`, 'i') });
    }

    const yearMatchConditions = [
      { 'filters.year': null },
      { 'filters.year': { $exists: false } },
    ];
    if (year !== null) {
      yearMatchConditions.push({ 'filters.year': year });
    }

    const sectionMatchConditions = [
      { 'filters.section': null },
      { 'filters.section': '' },
      { 'filters.section': { $exists: false } },
    ];
    if (section) {
      sectionMatchConditions.push({ 'filters.section': new RegExp(`^${escapeRegex(section)}$`, 'i') });
    }

    // Build matching query conditions:
    // 1. Only Published (or legacy records without status field) — NEVER Draft
    // 2. Non-expired
    // 3. Role, Department, Year, Section match user or target all
    const query = {
      $and: [
        {
          $or: [
            { status: 'Published' },
            { status: { $exists: false } },
          ],
        },
        {
          $or: [
            { expiresAt: null },
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: now } },
          ],
        },
        {
          $or: [
            { 'filters.role': 'all' },
            { 'filters.role': { $exists: false } },
            { 'filters.role': role },
          ],
        },
        { $or: deptMatchConditions },
        { $or: yearMatchConditions },
        { $or: sectionMatchConditions },
      ],
    };

    const announcements = await Announcement.find(query)
      .populate('postedBy', 'name email')
      .sort({ publishedAt: -1, createdAt: -1 })
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
