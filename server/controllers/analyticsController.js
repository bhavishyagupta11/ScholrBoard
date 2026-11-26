/**
 * analyticsController.js — Learning analytics and progress tracking
 */
import LearningProgress from '../models/LearningProgress.js';
import Analytics from '../models/Analytics.js';
import { withTransaction } from '../utils/withTransaction.js';
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

    if (!Number.isSafeInteger(Number(minutesStudied)) || Number(minutesStudied) <= 0 || !['number', 'string'].includes(typeof minutesStudied)) {
      return res.status(400).json({ success: false, message: 'minutesStudied must be a positive number' });
    }

    const today = toMidnight();
    const profile = await Profile.findOne({ userId: req.user._id }).select('learningGoalMinutesPerDay').lean();

    // Upsert: increment fields if a record for today already exists
    const progress = await LearningProgress.findOneAndUpdate(
      { userId: req.user._id, date: today },
      {
        $inc: {
          totalMinutesStudied: Number(minutesStudied),
          sessionsCount:       1,
          ...(leetcodeSolvedToday && { leetcodeSolvedToday }),
          ...(githubCommitsToday  && { githubCommitsToday }),
        },
        $set: {
          moodScore:          moodScore || null,
          dailyGoalMinutes:   profile?.learningGoalMinutesPerDay ?? 30,
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
    const today = toMidnight().getTime();
    const dayMs = 86400000;

    // Run all queries in parallel for speed
    const [
      activityCounts,
      categoryCounts,
      dailyRecords,
      latestAnalytics,
      profile,
    ] = await Promise.all([
      // Activity approval breakdown
      Activity.aggregate([
        { $match: { userId: userObjectId, isArchived: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Activity category breakdown
      Activity.aggregate([
        { $match: { userId: userObjectId, isArchived: false } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),

      // One retained record per student per UTC day.
      LearningProgress.find({ userId, date: { $lte: new Date(today) } })
        .sort({ date: 1 }).select('date totalMinutesStudied goalAchieved sessionsCount').lean(),

      // Latest pre-computed analytics snapshot
      Analytics.findOne({ userId, period: 'monthly' }).sort({ periodStart: -1 }),

      // User Profile (single source of truth for GPA)
      Profile.findOne({ userId }),
    ]);

    const activitySummary = { Pending: 0, Approved: 0, Rejected: 0, byCategory: {}, total: 0 };
    activityCounts.forEach(({ _id, count }) => {
      if (_id in activitySummary) activitySummary[_id] = count;
      activitySummary.total += count;
    });
    categoryCounts.forEach(({ _id, count }) => {
      if (_id) activitySummary.byCategory[_id] = count;
    });

    const weeklyProgress = dailyRecords.filter(record => record.date.getTime() >= today - 6 * dayMs);
    const weeklyStudyMinutes = weeklyProgress.reduce((s, r) => s + (r.totalMinutesStudied || 0), 0);
    let previousDay = null;
    let run = 0;
    let longestStreak = latestAnalytics?.longestStreak ?? 0;
    for (const record of dailyRecords) {
      if (record.totalMinutesStudied <= 0) continue;
      const day = record.date.getTime();
      run = previousDay !== null && day - previousDay === dayMs ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
      previousDay = day;
    }

    const responseData = {
      success: true,
      analytics: {
        activities:        activitySummary,
        weeklyStudyMinutes,
        weeklyProgress,
        gpa:               profile?.gpa ?? null,
        attendance:        profile?.attendanceOverall ?? latestAnalytics?.overallAttendance ?? null,
        currentStreak:     previousDay === today ? run : 0,
        longestStreak,
        totalPoints:       profile?.achievementPoints ?? latestAnalytics?.totalPointsEarned ?? 0,
        percentileRank:    latestAnalytics?.percentileRank ?? null,
        aiInsight:         latestAnalytics?.aiInsight || null,
        subjectBreakdown:  latestAnalytics?.subjectBreakdown || [],
      },
    };
    return res.json(responseData);
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

    const analytics = await withTransaction(async (session) => {
      const snapshot = await Analytics.findOneAndUpdate(
        { userId: req.user._id, period: 'monthly', periodStart },
        { $set: { ...updates, periodEnd } },
        { new: true, upsert: true, runValidators: true, session }
      );
      const academicFields = {};
      if (gpa !== undefined) academicFields.gpa = gpa;
      if (attendance !== undefined) academicFields.attendanceOverall = attendance;
      if (Object.keys(academicFields).length) {
        await Profile.updateOne({ userId: req.user._id }, { $set: academicFields }, { session, runValidators: true, upsert: true });
      }
      return snapshot;
    });

    return res.json({ success: true, message: 'Academic data updated', analytics });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid academic data' });
    }
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
        const match = { isArchived: { $ne: true } };
        if (req.user.role === 'faculty') {
          const students = await User.find({ role: 'student', advisorId: req.user._id, ...excludeTestUsers() }).select('_id');
          match.userId = { $in: students.map((student) => student._id) };
        } else {
          const testUsers = await User.find({ email: TEST_EMAIL_REGEX }).select('_id');
          match.userId = { $nin: testUsers.map(u => u._id) };
        }
        return Activity.aggregate([
          { $match: match },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
      })(),
      (async () => {
        const query = { status: 'Pending', isArchived: { $ne: true } };
        if (req.user.role === 'faculty') {
          const students = await User.find({ role: 'student', advisorId: req.user._id, ...excludeTestUsers() }).select('_id');
          query.userId = { $in: students.map((student) => student._id) };
        } else {
          const testUsers = await User.find({ email: TEST_EMAIL_REGEX }).select('_id');
          query.userId = { $nin: testUsers.map(u => u._id) };
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

/**
 * Normalizes a numeric salary value to LPA (Lakhs Per Annum).
 * - Numbers >= 1000 are stored in INR (e.g. 700000 -> 7 LPA, 1200000 -> 12 LPA).
 * - Positive numbers < 1000 are already in LPA (e.g. 13 -> 13 LPA, 7.5 -> 7.5 LPA).
 * - Zero, negative, null, undefined, or non-numeric values return null (missing/unavailable).
 */
export const normalizeSalaryPackageLpa = (rawSalary) => {
  if (rawSalary === null || rawSalary === undefined || rawSalary === '') return null;
  const num = Number(rawSalary);
  if (!Number.isFinite(num) || num <= 0) return null;
  const lpa = num >= 1000 ? num / 100000 : num;
  return Math.round(lpa * 100) / 100;
};

/**
 * Pure placement statistics computation used by getPlacementAnalytics and unit tests.
 *
 * Rules:
 *  - Deduplicate applications per (studentId, opportunityId) to neutralize duplicate records.
 *  - Only unique active/eligible students present in the denominator are counted once in placed count.
 *  - Multi-offer rule: each placed student contributes their highest valid (> 0) LPA offer;
 *    offers missing salary data do not become 0 LPA and are excluded from package averages.
 *  - Overall and department-wise highest/average packages use this exact same per-student set.
 */
export const computePlacementAnalyticsStats = ({ totalStudents = 0, deptStudentCounts = [], selectedApps = [] }) => {
  const deptMap = {};
  for (const d of deptStudentCounts) {
    if (d._id) {
      const deptKey = String(d._id).trim().toUpperCase();
      deptMap[deptKey] = {
        department: deptKey,
        totalStudents: Number(d.count) || 0,
        placedStudentMap: new Map(), // studentId -> bestPackageLpa (number | null)
      };
    }
  }

  // Track unique (studentId, opportunityId) rows to prevent duplicate records inflating counts
  const seenStudentOppPairs = new Set();
  const placedStudentsMap = new Map(); // studentId -> { department: string | null, bestPackageLpa: number | null }

  for (const app of selectedApps) {
    const studentObj = app?.studentId;
    const rawStudentId = studentObj && typeof studentObj === 'object' ? studentObj._id : studentObj;
    if (!rawStudentId) continue;

    // Exclude deactivated/deleted populated user records if isActive is explicitly false
    if (studentObj && typeof studentObj === 'object' && studentObj.isActive === false) continue;

    const studentId = String(rawStudentId);
    const rawOppId = app?.opportunityId && typeof app.opportunityId === 'object'
      ? app.opportunityId._id
      : app?.opportunityId;
    const pairKey = `${studentId}::${rawOppId ? String(rawOppId) : String(app._id || Math.random())}`;
    if (seenStudentOppPairs.has(pairKey)) continue;
    seenStudentOppPairs.add(pairKey);

    const deptRaw = studentObj && typeof studentObj === 'object' ? studentObj.department : app?.department;
    const deptKey = deptRaw && String(deptRaw).trim() ? String(deptRaw).trim().toUpperCase() : null;
    const lpa = normalizeSalaryPackageLpa(
      app?.opportunityId && typeof app.opportunityId === 'object'
        ? app.opportunityId.salaryPackage
        : app?.salaryPackage
    );

    const existingStudent = placedStudentsMap.get(studentId);
    if (!existingStudent) {
      placedStudentsMap.set(studentId, {
        department: deptKey,
        bestPackageLpa: lpa,
      });
    } else if (lpa !== null && (existingStudent.bestPackageLpa === null || lpa > existingStudent.bestPackageLpa)) {
      existingStudent.bestPackageLpa = lpa;
    }

    if (deptKey) {
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = {
          department: deptKey,
          totalStudents: 0,
          placedStudentMap: new Map(),
        };
      }
      const deptEntry = deptMap[deptKey].placedStudentMap;
      const prevBest = deptEntry.get(studentId);
      if (prevBest === undefined) {
        deptEntry.set(studentId, lpa);
      } else if (lpa !== null && (prevBest === null || lpa > prevBest)) {
        deptEntry.set(studentId, lpa);
      }
    }
  }

  const totalPlaced = placedStudentsMap.size;
  const placementPercentage = totalStudents > 0
    ? Math.round((totalPlaced / totalStudents) * 1000) / 10
    : 0;

  const overallValidPackages = Array.from(placedStudentsMap.values())
    .map((entry) => entry.bestPackageLpa)
    .filter((pkg) => pkg !== null);

  const highestPackage = overallValidPackages.length > 0
    ? Math.max(...overallValidPackages)
    : null;
  const averagePackage = overallValidPackages.length > 0
    ? Math.round((overallValidPackages.reduce((sum, p) => sum + p, 0) / overallValidPackages.length) * 100) / 100
    : null;

  const departmentBreakdown = Object.values(deptMap).map((d) => {
    const placedCount = d.placedStudentMap.size;
    const validDeptPackages = Array.from(d.placedStudentMap.values()).filter((pkg) => pkg !== null);
    const highest = validDeptPackages.length > 0 ? Math.max(...validDeptPackages) : null;
    const average = validDeptPackages.length > 0
      ? Math.round((validDeptPackages.reduce((sum, p) => sum + p, 0) / validDeptPackages.length) * 100) / 100
      : null;
    const percentage = d.totalStudents > 0
      ? Math.round((placedCount / d.totalStudents) * 1000) / 10
      : 0;

    return {
      department: d.department,
      totalStudents: d.totalStudents,
      placed: placedCount,
      percentage,
      highest,
      average,
      validSalaryCount: validDeptPackages.length,
    };
  });

  return {
    totalStudents,
    totalPlaced,
    placementPercentage,
    highestPackage,
    averagePackage,
    validSalaryCount: overallValidPackages.length,
    packageUnit: 'LPA',
    multiOfferPolicy: 'highest_valid_package_per_student',
    departmentBreakdown,
  };
};

// ─── ADMIN/FACULTY: Placement analytics statistics ───────────────────────────
export const getPlacementAnalytics = async (req, res) => {
  try {
    const User = mongoose.model('User');
    const Application = mongoose.model('Application');

    const [totalStudents, testUsers, deptStudentCounts] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true, ...excludeTestUsers() }),
      User.find({ email: TEST_EMAIL_REGEX }).select('_id'),
      User.aggregate([
        { $match: { role: 'student', isActive: true, ...excludeTestUsers() } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]),
    ]);

    const testUserIds = testUsers.map((u) => u._id);

    const selectedApps = await Application.find({ status: 'Selected', studentId: { $nin: testUserIds } })
      .populate('studentId', 'department isActive role')
      .populate('opportunityId', 'salaryPackage');

    const activeSelectedApps = selectedApps.filter(
      (app) => app.studentId && app.studentId.isActive !== false && app.studentId.role === 'student'
    );

    const stats = computePlacementAnalyticsStats({
      totalStudents,
      deptStudentCounts,
      selectedApps: activeSelectedApps,
    });

    return res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('getPlacementAnalytics error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch placement analytics' });
  }
};

// ─── FACULTY: Advisor activity analytics ─────────────────────────────────────
export const getFacultyActivityStats = async (req, res) => {
  try {
    const { default: User } = await import('../models/User.js');

    // Find assigned advisees, excluding test users
    const students = await User.find({ role: 'student', advisorId: req.user._id, ...excludeTestUsers() }).select('_id');
    const studentIds = students.map((s) => s._id);

    const activityStats = await Activity.aggregate([
      { $match: { userId: { $in: studentIds }, isArchived: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const activitySummary = { Pending: 0, Approved: 0, Rejected: 0 };
    activityStats.forEach(({ _id, count }) => {
      if (_id in activitySummary) activitySummary[_id] = count;
    });

    return res.json({
      success: true,
      pending: activitySummary.Pending,
      approved: activitySummary.Approved,
      rejected: activitySummary.Rejected,
      activitySummary,
    });
  } catch (error) {
    console.error('getFacultyActivityStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch faculty stats' });
  }
};

// ─── COORDINATOR: Scoped department analytics ──────────────────────────────────
export const getCoordinatorAnalytics = async (req, res) => {
  try {
    const { default: User } = await import('../models/User.js');
    const { default: Profile } = await import('../models/Profile.js');
    const { default: Activity } = await import('../models/Activity.js');
    const { default: OdRequest } = await import('../models/OdRequest.js');
    const { default: SupportTicket } = await import('../models/SupportTicket.js');

    const department = req.user.department;
    if (!department) {
      return res.status(400).json({ success: false, message: 'Coordinator must have a department assigned.' });
    }

    // 1. Student stats
    // Total Students in department
    const totalStudents = await User.countDocuments({
      role: 'student',
      department,
      ...excludeTestUsers()
    });

    // Active Students in department
    const activeStudents = await User.countDocuments({
      role: 'student',
      department,
      isActive: true,
      ...excludeTestUsers()
    });

    // Student IDs for profile and activity aggregation
    const studentUsers = await User.find({
      role: 'student',
      department,
      isActive: true,
      ...excludeTestUsers()
    }).select('_id');
    const studentIds = studentUsers.map(s => s._id);

    // Placement Ready Students (placementReadinessScore >= 75)
    const placementReadyCount = await Profile.countDocuments({
      userId: { $in: studentIds },
      placementReadinessScore: { $gte: 75 }
    });

    // At Risk Students (GPA < 6.0 OR attendanceOverall < 75 OR backlogs > 0)
    const atRiskCount = await Profile.countDocuments({
      userId: { $in: studentIds },
      $or: [
        { gpa: { $lt: 6.0, $ne: null } },
        { attendanceOverall: { $lt: 75, $ne: null } },
        { backlogs: { $gt: 0 } }
      ]
    });

    // 2. Faculty stats
    const totalFaculty = await User.countDocuments({
      role: 'faculty',
      department,
      isActive: true
    });

    // Pending Approvals (Activities)
    const pendingApprovalsCount = await Activity.countDocuments({
      userId: { $in: studentIds },
      status: 'Pending'
    });

    // Pending ODs
    const pendingOdsCount = await OdRequest.countDocuments({
      studentId: { $in: studentIds },
      status: 'Pending'
    });

    // Faculty Workload
    const departmentFaculty = await User.find({
      role: 'faculty',
      department,
      isActive: true
    }).select('_id name');

    const facultyWorkload = await Promise.all(
      departmentFaculty.map(async (fac) => {
        const count = await User.countDocuments({
          role: 'student',
          advisorId: fac._id,
          isActive: true,
          ...excludeTestUsers()
        });
        return {
          facultyId: fac._id,
          name: fac.name,
          adviseeCount: count
        };
      })
    );

    // 3. Ticket stats
    const openTicketsCount = await SupportTicket.countDocuments({
      department,
      status: { $in: ['open', 'in_progress', 'waiting_for_response'] }
    });

    const resolvedTicketsCount = await SupportTicket.countDocuments({
      department,
      status: { $in: ['resolved', 'closed'] }
    });

    const escalatedTicketsCount = await SupportTicket.countDocuments({
      department,
      status: { $in: ['open', 'in_progress', 'waiting_for_response'] },
      priority: { $in: ['high', 'urgent'] }
    });

    return res.json({
      success: true,
      stats: {
        students: {
          total: totalStudents,
          active: activeStudents,
          placementReady: placementReadyCount,
          atRisk: atRiskCount
        },
        faculty: {
          total: totalFaculty,
          pendingApprovals: pendingApprovalsCount,
          pendingOds: pendingOdsCount,
          workload: facultyWorkload
        },
        tickets: {
          open: openTicketsCount,
          resolved: resolvedTicketsCount,
          escalated: escalatedTicketsCount
        }
      }
    });
  } catch (error) {
    console.error('getCoordinatorAnalytics error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch coordinator analytics' });
  }
};
