/**
 * analyticsController.js — Learning analytics and progress tracking
 */
import LearningProgress from '../models/LearningProgress.js';
import Analytics from '../models/Analytics.js';
import Activity from '../models/Activity.js';
import Profile from '../models/Profile.js';
import mongoose from 'mongoose';
import { excludeTestUsers, TEST_EMAIL_REGEX } from '../utils/testFilters.js';

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
      profile,
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

      // User Profile (for GPA and overall attendance fallbacks)
      Profile.findOne({ userId }),
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
        gpa:               latestAnalytics?.currentGPA || profile?.gpa || null,
        attendance:        latestAnalytics?.overallAttendance || profile?.attendanceOverall || null,
        currentStreak:     latestAnalytics?.currentStreak || 0,
        longestStreak:     latestAnalytics?.longestStreak || 0,
        totalPoints:       latestAnalytics?.totalPointsEarned || profile?.achievementPoints || 0,
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
        ...excludeTestUsers(),
        ...(req.user.role === 'faculty' ? { advisorId: req.user._id } : {}),
      }),
      req.user.role === 'admin'
        ? User.countDocuments({ role: 'faculty', isActive: true, ...excludeTestUsers() })
        : Promise.resolve(1),
      (async () => {
        const match = {};
        if (req.user.role === 'faculty') {
          const students = await User.find({ role: 'student', advisorId: req.user._id, ...excludeTestUsers() }).select('_id');
          match.userId = { $in: students.map((student) => student._id) };
        }
        return Activity.aggregate([
          { $match: match },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
      })(),
      (async () => {
        const query = { status: 'Pending' };
        if (req.user.role === 'faculty') {
          const students = await User.find({ role: 'student', advisorId: req.user._id, ...excludeTestUsers() }).select('_id');
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

// ─── ADMIN/FACULTY: Placement analytics statistics ───────────────────────────
export const getPlacementAnalytics = async (req, res) => {
  try {
    const User = mongoose.model('User');
    const Application = mongoose.model('Application');

    // 1. Get total students registered
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true, ...excludeTestUsers() });

    // Exclude test users from placement counts
    const testUsers = await User.find({ email: TEST_EMAIL_REGEX }).select('_id');
    const testUserIds = testUsers.map(u => u._id);

    // 2. Get unique placed student count (Application status is 'Selected')
    const placedStudentIds = await Application.distinct('studentId', { status: 'Selected', studentId: { $nin: testUserIds } });
    const totalPlaced = placedStudentIds.length;

    const placementPercentage = totalStudents > 0 ? Math.round((totalPlaced / totalStudents) * 1000) / 10 : 0;

    // 3. Get all selected applications populated with package details
    const selectedApps = await Application.find({ status: 'Selected', studentId: { $nin: testUserIds } })
      .populate('studentId', 'department')
      .populate('opportunityId', 'salaryPackage');

    const packages = selectedApps.map(a => a.opportunityId?.salaryPackage || 0).filter(Boolean);
    const highestPackage = packages.length > 0 ? Math.max(...packages) : 0;
    const averagePackage = packages.length > 0 ? Math.round(packages.reduce((sum, p) => sum + p, 0) / packages.length) : 0;

    // 4. Department breakdown
    const deptStudents = await User.aggregate([
      { $match: { role: 'student', isActive: true, ...excludeTestUsers() } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    const deptMap = {};
    deptStudents.forEach(d => {
      if (d._id) {
        const deptKey = d._id.toUpperCase();
        deptMap[deptKey] = {
          department: deptKey,
          totalStudents: d.count,
          placed: 0,
          highest: 0,
          packagesSum: 0,
          average: 0
        };
      }
    });

    selectedApps.forEach(app => {
      const dept = app.studentId?.department?.toUpperCase();
      const salary = app.opportunityId?.salaryPackage || 0;
      if (dept) {
        if (!deptMap[dept]) {
          deptMap[dept] = { department: dept, totalStudents: 0, placed: 0, highest: 0, packagesSum: 0, average: 0 };
        }
        deptMap[dept].placed += 1;
        if (salary > deptMap[dept].highest) {
          deptMap[dept].highest = salary;
        }
        if (salary > 0) {
          deptMap[dept].packagesSum += salary;
        }
      }
    });

    const departmentBreakdown = Object.values(deptMap).map(d => {
      const placedCount = d.placed;
      const avg = placedCount > 0 ? Math.round(d.packagesSum / placedCount) : 0;
      const pct = d.totalStudents > 0 ? Math.round((placedCount / d.totalStudents) * 1000) / 10 : 0;
      
      return {
        department: d.department,
        totalStudents: d.totalStudents,
        placed: placedCount,
        percentage: pct,
        highest: d.highest,
        average: avg
      };
    });

    return res.json({
      success: true,
      stats: {
        totalPlaced,
        placementPercentage,
        highestPackage,
        averagePackage,
        departmentBreakdown
      }
    });
  } catch (error) {
    console.error('getPlacementAnalytics error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch placement analytics' });
  }
};
