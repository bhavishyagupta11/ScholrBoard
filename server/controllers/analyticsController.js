/**
 * analyticsController.js — Learning analytics and progress tracking
 */
import LearningProgress from '../models/LearningProgress.js';
import Analytics from '../models/Analytics.js';
import Activity from '../models/Activity.js';
import mongoose from 'mongoose';

// Helper: normalize a date to midnight UTC (strips time component)
const toMidnight = (d = new Date()) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

// ─── LOG a study session for today ───────────────────────────────────────────
export const logStudySession = async (req, res) => {
  try {
    const { minutesStudied, topics, moodScore, leetcodeSolvedToday, githubCommitsToday } = req.body;

    if (!minutesStudied || minutesStudied <= 0) {
      return res.status(400).json({ success: false, message: 'minutesStudied must be a positive number' });
    }

    const today = toMidnight();

    // Upsert: increment fields if a record for today already exists
    const progress = await LearningProgress.findOneAndUpdate(
      { userId: req.user._id, date: today },
      {
        $inc: {
          totalMinutesStudied: minutesStudied,
          sessionsCount:       1,
          ...(leetcodeSolvedToday && { leetcodeSolvedToday }),
          ...(githubCommitsToday  && { githubCommitsToday }),
        },
        $set: {
          moodScore:          moodScore || null,
          dailyGoalMinutes:   req.user.learningGoalMinutes || 30,
        },
        $push: topics?.length ? { topics: { $each: topics } } : {},
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Mark goal achieved if total >= goal
    if (progress.totalMinutesStudied >= progress.dailyGoalMinutes) {
      progress.goalAchieved = true;
      await progress.save();
    }

    return res.status(201).json({ success: true, message: 'Study session logged', progress });
  } catch (error) {
    console.error('logStudySession error:', error);
    return res.status(500).json({ success: false, message: 'Failed to log study session' });
  }
};

// ─── GET user's learning progress (last N days) ───────────────────────────────
export const getLearningProgress = async (req, res) => {
  try {
    const { days = 14 } = req.query;
    const numDays = Math.min(Math.max(Number(days), 1), 90); // clamp 1–90

    const since = toMidnight(new Date(Date.now() - (numDays - 1) * 86400000));

    const records = await LearningProgress.find({
      userId: req.user._id,
      date:   { $gte: since },
    }).sort({ date: 1 }).select('-__v -userId');

    // Fill in zeros for missing days (so charts have complete data)
    const filled = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = toMidnight(new Date(Date.now() - i * 86400000));
      const found = records.find(
        (r) => r.date.toISOString().slice(0, 10) === d.toISOString().slice(0, 10)
      );
      filled.push(
        found || {
          date:                d,
          totalMinutesStudied: 0,
          sessionsCount:       0,
          goalAchieved:        false,
          leetcodeSolvedToday: 0,
          githubCommitsToday:  0,
        }
      );
    }

    // Compute current streak
    let streak = 0;
    for (let i = filled.length - 1; i >= 0; i--) {
      if (filled[i].totalMinutesStudied > 0) streak++;
      else break;
    }

    return res.json({
      success: true,
      progress: filled,
      streak,
      totalMinutes: filled.reduce((s, r) => s + (r.totalMinutesStudied || 0), 0),
    });
  } catch (error) {
    console.error('getLearningProgress error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch learning progress' });
  }
};

// ─── GET aggregated analytics (dashboard stats) ───────────────────────────────
export const getDashboardAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Run all queries in parallel for speed
    const [
      activityCounts,
      weeklyProgress,
      latestAnalytics,
    ] = await Promise.all([
      // Activity approval breakdown
      Activity.aggregate([
        { $match: { userId: userObjectId, isArchived: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Last 7 days study time
      LearningProgress.find({
        userId,
        date: { $gte: toMidnight(new Date(Date.now() - 6 * 86400000)) },
      }).sort({ date: 1 }).select('date totalMinutesStudied goalAchieved sessionsCount'),

      // Latest pre-computed analytics snapshot
      Analytics.findOne({ userId, period: 'monthly' }).sort({ periodStart: -1 }),
    ]);

    const activitySummary = { Pending: 0, Approved: 0, Rejected: 0 };
    activityCounts.forEach(({ _id, count }) => { if (_id in activitySummary) activitySummary[_id] = count; });

    const weeklyStudyMinutes = weeklyProgress.reduce((s, r) => s + r.totalMinutesStudied, 0);

    return res.json({
      success: true,
      analytics: {
        activities:        activitySummary,
        weeklyStudyMinutes,
        weeklyProgress,
        gpa:               latestAnalytics?.currentGPA || null,
        attendance:        latestAnalytics?.overallAttendance || null,
        currentStreak:     latestAnalytics?.currentStreak || 0,
        longestStreak:     latestAnalytics?.longestStreak || 0,
        totalPoints:       latestAnalytics?.totalPointsEarned || 0,
        percentileRank:    latestAnalytics?.percentileRank || null,
        aiInsight:         latestAnalytics?.aiInsight || null,
        subjectBreakdown:  latestAnalytics?.subjectBreakdown || [],
      },
    });
  } catch (error) {
    console.error('getDashboardAnalytics error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};

// ─── UPDATE academic data (GPA, attendance per subject) ───────────────────────
export const updateAcademicData = async (req, res) => {
  try {
    const { gpa, attendance, subjects } = req.body;

    // Find or create current month analytics record
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const updates = { computedAt: new Date() };
    if (gpa        !== undefined) updates.currentGPA         = gpa;
    if (attendance !== undefined) updates.overallAttendance  = attendance;
    if (subjects   !== undefined) updates.subjectBreakdown   = subjects;

    const analytics = await Analytics.findOneAndUpdate(
      { userId: req.user._id, period: 'monthly', periodStart },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Also update profile GPA for quick access
    if (gpa !== undefined) {
      const { default: Profile } = await import('../models/Profile.js');
      await Profile.findOneAndUpdate({ userId: req.user._id }, { $set: { gpa } });
    }

    return res.json({ success: true, message: 'Academic data updated', analytics });
  } catch (error) {
    console.error('updateAcademicData error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update academic data' });
  }
};

// ─── ADMIN: System-wide analytics ────────────────────────────────────────────
export const getSystemAnalytics = async (req, res) => {
  try {
    const { default: User } = await import('../models/User.js');

    const [
      totalStudents,
      totalFaculty,
      activityStats,
      recentActivities,
    ] = await Promise.all([
      User.countDocuments({
        role: 'student',
        isActive: true,
        ...(req.user.role === 'faculty' && req.user.department ? { department: req.user.department } : {}),
      }),
      req.user.role === 'admin'
        ? User.countDocuments({ role: 'faculty', isActive: true })
        : Promise.resolve(1),
      (async () => {
        const match = {};
        if (req.user.role === 'faculty' && req.user.department) {
          const students = await User.find({ role: 'student', department: req.user.department }).select('_id');
          match.userId = { $in: students.map((student) => student._id) };
        }
        return Activity.aggregate([
          { $match: match },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
      })(),
      (async () => {
        const query = { status: 'Pending' };
        if (req.user.role === 'faculty' && req.user.department) {
          const students = await User.find({ role: 'student', department: req.user.department }).select('_id');
          query.userId = { $in: students.map((student) => student._id) };
        }
        return Activity.find(query)
        .populate('userId', 'name studentId department')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('title category status createdAt');
      })(),
    ]);

    const activitySummary = { Pending: 0, Approved: 0, Rejected: 0, Total: 0 };
    activityStats.forEach(({ _id, count }) => {
      if (_id in activitySummary) activitySummary[_id] = count;
      activitySummary.Total += count;
    });

    const approvalRate = activitySummary.Total > 0
      ? Math.round((activitySummary.Approved / activitySummary.Total) * 100)
      : 0;

    return res.json({
      success: true,
      systemAnalytics: {
        totalStudents,
        totalFaculty,
        activitySummary,
        approvalRate,
        recentPendingActivities: recentActivities,
      },
    });
  } catch (error) {
    console.error('getSystemAnalytics error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch system analytics' });
  }
};
