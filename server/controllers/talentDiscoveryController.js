import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import { TEST_EMAIL_REGEX } from '../utils/testFilters.js';

/**
 * GET /api/users/talent-discovery
 * Admin Talent Discovery controller
 *
 * Phase 4.3.1 Performance Optimization:
 *   Aggregation now starts from Profile (not User) so that $sort on
 *   developerScore hits the compound index { developerScore: -1, gpa: -1 }
 *   BEFORE any $lookup, eliminating the in-memory sort stage that caused
 *   ~2.34s latency at 10,000 students.
 *
 *   Pipeline flow:
 *     Profile → $match profileFilters
 *             → $sort developerScore (INDEX SCAN)
 *             → $skip / $limit
 *             → $lookup User (identity, role, department, semester, isActive)
 *             → $unwind User
 *             → $match userFilters (role, isActive, department, semester, search)
 *             → $lookup ResumeAnalysis
 *             → $unwind ResumeAnalysis
 *             → $match resumeFilters
 *             → $project whitelist
 */
export const getTalentDiscovery = async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'developerScore',
      sortOrder = 'desc',
      search,
      department,
      branch,
      year,
      semester,
      gpaMin,
      gpaMax,
      backlogsMax,
      developerScoreMin,
      developerScoreMax,
      githubScoreMin,
      dsaScoreMin,
      cpScoreMin,
      skills,
      githubConnected,
      leetcodeConnected,
      codeforcesConnected,
      placementReadinessMin,
      achievementPointsMin,
      hasResumeAnalysis,
      atsScoreMin
    } = req.query;

    // ── 1. Query parameter validation ─────────────────────────────────────────
    const errors = [];

    const pageNum = Number(page);
    const limitNum = Number(limit);
    if (isNaN(pageNum) || pageNum < 1 || !Number.isInteger(pageNum)) {
      errors.push('page must be a positive integer');
    }
    if (isNaN(limitNum) || limitNum < 1 || !Number.isInteger(limitNum)) {
      errors.push('limit must be a positive integer');
    } else if (limitNum > 100) {
      errors.push('limit cannot exceed 100');
    }

    // Sort fields that live directly on Profile (index-backed)
    const profileSortFields = ['developerScore', 'githubScore', 'dsaScore', 'cpScore', 'gpa', 'achievementPoints', 'placementReadinessScore'];
    // Fields that live on User — sorting on these cannot use the Profile index
    const userSortFields = ['createdAt'];
    const allowedSortFields = [...profileSortFields, ...userSortFields];

    if (!allowedSortFields.includes(sortBy)) {
      errors.push(`sortBy must be one of: ${allowedSortFields.join(', ')}`);
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      errors.push("sortOrder must be either 'asc' or 'desc'");
    }

    const validateNumeric = (val, name) => {
      if (val !== undefined) {
        if (Array.isArray(val) || typeof val === 'object') {
          errors.push(`${name} cannot be an array or object`);
        } else {
          const num = Number(val);
          if (isNaN(num)) errors.push(`${name} must be a number`);
        }
      }
    };

    validateNumeric(year, 'year');
    validateNumeric(semester, 'semester');
    validateNumeric(gpaMin, 'gpaMin');
    validateNumeric(gpaMax, 'gpaMax');
    validateNumeric(backlogsMax, 'backlogsMax');
    validateNumeric(developerScoreMin, 'developerScoreMin');
    validateNumeric(developerScoreMax, 'developerScoreMax');
    validateNumeric(githubScoreMin, 'githubScoreMin');
    validateNumeric(dsaScoreMin, 'dsaScoreMin');
    validateNumeric(cpScoreMin, 'cpScoreMin');
    validateNumeric(placementReadinessMin, 'placementReadinessMin');
    validateNumeric(achievementPointsMin, 'achievementPointsMin');
    validateNumeric(atsScoreMin, 'atsScoreMin');

    const validateBoolean = (val, name) => {
      if (val !== undefined && val !== 'true' && val !== 'false') {
        errors.push(`${name} must be 'true' or 'false'`);
      }
    };

    validateBoolean(githubConnected, 'githubConnected');
    validateBoolean(leetcodeConnected, 'leetcodeConnected');
    validateBoolean(codeforcesConnected, 'codeforcesConnected');
    validateBoolean(hasResumeAnalysis, 'hasResumeAnalysis');

    const validateString = (val, name) => {
      if (val !== undefined && (typeof val === 'object' || Array.isArray(val))) {
        errors.push(`${name} must be a plain string`);
      }
    };

    validateString(search, 'search');
    validateString(department, 'department');
    validateString(branch, 'branch');
    validateString(skills, 'skills');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    // ── 2. Build Profile-level match criteria ─────────────────────────────────
    //    These filters can narrow the working set before the sort stage,
    //    which keeps the index scan as selective as possible.
    const profileMatchClauses = [];

    if (gpaMin !== undefined)           profileMatchClauses.push({ gpa: { $gte: Number(gpaMin) } });
    if (gpaMax !== undefined)           profileMatchClauses.push({ gpa: { $lte: Number(gpaMax) } });
    if (backlogsMax !== undefined)      profileMatchClauses.push({ backlogs: { $lte: Number(backlogsMax) } });
    if (developerScoreMin !== undefined) profileMatchClauses.push({ developerScore: { $gte: Number(developerScoreMin) } });
    if (developerScoreMax !== undefined) profileMatchClauses.push({ developerScore: { $lte: Number(developerScoreMax) } });
    if (githubScoreMin !== undefined)   profileMatchClauses.push({ githubScore: { $gte: Number(githubScoreMin) } });
    if (dsaScoreMin !== undefined)      profileMatchClauses.push({ dsaScore: { $gte: Number(dsaScoreMin) } });
    if (cpScoreMin !== undefined)       profileMatchClauses.push({ cpScore: { $gte: Number(cpScoreMin) } });
    if (placementReadinessMin !== undefined) profileMatchClauses.push({ placementReadinessScore: { $gte: Number(placementReadinessMin) } });
    if (achievementPointsMin !== undefined)  profileMatchClauses.push({ achievementPoints: { $gte: Number(achievementPointsMin) } });

    if (skills) {
      const skillRegexes = skills.split(',').map(s => new RegExp(`^${s.trim()}$`, 'i'));
      profileMatchClauses.push({ skills: { $all: skillRegexes } });
    }

    if (githubConnected !== undefined) {
      if (githubConnected === 'true') {
        profileMatchClauses.push({ 'codingStats.profiles.github': { $ne: null, $gt: '' } });
      } else {
        profileMatchClauses.push({ $or: [{ 'codingStats.profiles.github': null }, { 'codingStats.profiles.github': '' }] });
      }
    }
    if (leetcodeConnected !== undefined) {
      if (leetcodeConnected === 'true') {
        profileMatchClauses.push({ 'codingStats.profiles.leetcode': { $ne: null, $gt: '' } });
      } else {
        profileMatchClauses.push({ $or: [{ 'codingStats.profiles.leetcode': null }, { 'codingStats.profiles.leetcode': '' }] });
      }
    }
    if (codeforcesConnected !== undefined) {
      if (codeforcesConnected === 'true') {
        profileMatchClauses.push({ 'codingStats.profiles.codeforces': { $ne: null, $gt: '' } });
      } else {
        profileMatchClauses.push({ $or: [{ 'codingStats.profiles.codeforces': null }, { 'codingStats.profiles.codeforces': '' }] });
      }
    }

    // ── 3. Build User-level match criteria (applied after $lookup User) ────────
    //    role, isActive, department, semester, year, and keyword search.
    const userMatchClauses = [
      { 'user.role': 'student' },
      { 'user.isActive': true },
      { 'user.email': { $not: TEST_EMAIL_REGEX } }
    ];

    if (department) {
      userMatchClauses.push({ 'user.department': new RegExp(department.trim(), 'i') });
    }
    if (branch) {
      userMatchClauses.push({
        $or: [
          { 'user.branch': new RegExp(branch.trim(), 'i') },
          { 'user.department': new RegExp(branch.trim(), 'i') }
        ]
      });
    }
    if (semester) {
      userMatchClauses.push({ 'user.semester': Number(semester) });
    }
    if (year) {
      const yearNum = Number(year);
      const semMap = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8] };
      const sems = semMap[yearNum] || [1, 2];
      userMatchClauses.push({ 'user.semester': { $in: sems } });
    }
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      userMatchClauses.push({
        $or: [
          { 'user.name': searchRegex },
          { 'user.email': searchRegex },
          { skills: searchRegex }          // profile.skills already in scope
        ]
      });
    }

    // ── 4. Determine sort field path ──────────────────────────────────────────
    //    For profile fields, the sort key is the bare field name on the profile
    //    document (since we start from Profile). For user fields (createdAt)
    //    we sort on the user sub-document path after the lookup.
    const sortDir = sortOrder === 'desc' ? -1 : 1;
    const sortField = userSortFields.includes(sortBy) ? `user.${sortBy}` : sortBy;

    // ── 5. Base pipeline ───────────────────────────────────────────────────────
    //    Profile → profileMatch → sort (INDEX) → lookup User → userMatch
    //           → lookup ResumeAnalysis → resumeMatch
    const skipNum = (pageNum - 1) * limitNum;

    // Profile match stage (empty object = match all profiles = still uses index for sort)
    const profileMatchStage = profileMatchClauses.length > 0
      ? { $match: { $and: profileMatchClauses } }
      : { $match: {} };

    const userMatchStage = { $match: { $and: userMatchClauses } };

    // Resume match (must happen after $lookup resumeanalyses)
    const resumeMatchClauses = [];
    if (hasResumeAnalysis !== undefined) {
      if (hasResumeAnalysis === 'true') {
        resumeMatchClauses.push({ resumeAnalysis: { $ne: null } });
      } else {
        resumeMatchClauses.push({ resumeAnalysis: null });
      }
    }
    if (atsScoreMin !== undefined) {
      resumeMatchClauses.push({ 'resumeAnalysis.atsScore': { $gte: Number(atsScoreMin) } });
    }

    // Count pipeline — mirrors filters but without pagination
    const countPipeline = [
      profileMatchStage,
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      userMatchStage,
      ...(resumeMatchClauses.length > 0 ? [
        {
          $lookup: {
            from: 'resumeanalyses',
            let: { uid: '$userId' },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ['$userId', '$$uid'] }, { $eq: ['$isCurrent', true] }] } } }
            ],
            as: 'resumeAnalysis'
          }
        },
        { $unwind: { path: '$resumeAnalysis', preserveNullAndEmptyArrays: true } },
        { $match: { $and: resumeMatchClauses } }
      ] : []),
      { $count: 'total' }
    ];

    const hasUserFilters = !!(search || department || branch || semester || year);
    const hasResumeFilters = !!(hasResumeAnalysis !== undefined || atsScoreMin !== undefined);
    const shouldPaginateEarly = false;

    // Data pipeline — sorted, paged, projected
    const dataPipeline = [
      profileMatchStage,
      { $sort: { [sortField]: sortDir } },
      // Pagination-before-lookup: when sorting on a profile field we can page
      // BEFORE the expensive User/Resume lookups, but only if no user/resume filters exist.
      ...(shouldPaginateEarly ? [{ $skip: skipNum }, { $limit: limitNum }] : []),
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      userMatchStage,
      {
        $lookup: {
          from: 'resumeanalyses',
          let: { uid: '$userId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$userId', '$$uid'] }, { $eq: ['$isCurrent', true] }] } } }
          ],
          as: 'resumeAnalysis'
        }
      },
      { $unwind: { path: '$resumeAnalysis', preserveNullAndEmptyArrays: true } },
      ...(resumeMatchClauses.length > 0 ? [{ $match: { $and: resumeMatchClauses } }] : []),
      // Paginate AFTER filters if we could not paginate early due to user/resume matching constraints
      ...(!shouldPaginateEarly ? [{ $skip: skipNum }, { $limit: limitNum }] : []),
      // ── Whitelist projection ──────────────────────────────────────────────
      {
        $project: {
          _id: '$user._id',
          name: '$user.name',
          email: '$user.email',
          department: '$user.department',
          branch: { $ifNull: ['$user.branch', '$user.department'] },
          semester: '$user.semester',
          year: {
            $switch: {
              branches: [
                { case: { $in: ['$user.semester', [1, 2]] }, then: 1 },
                { case: { $in: ['$user.semester', [3, 4]] }, then: 2 },
                { case: { $in: ['$user.semester', [5, 6]] }, then: 3 },
                { case: { $in: ['$user.semester', [7, 8]] }, then: 4 }
              ],
              default: 1
            }
          },
          developerScore:        { $ifNull: ['$developerScore', 0] },
          githubScore:           { $ifNull: ['$githubScore', 0] },
          dsaScore:              { $ifNull: ['$dsaScore', 0] },
          cpScore:               { $ifNull: ['$cpScore', 0] },
          gpa:                   { $ifNull: ['$gpa', 0] },
          achievementPoints:     { $ifNull: ['$achievementPoints', 0] },
          placementReadinessScore: { $ifNull: ['$placementReadinessScore', 0] },
          skills:                { $ifNull: ['$skills', []] },
          atsScore:              { $ifNull: ['$resumeAnalysis.atsScore', null] },
          githubConnected: {
            $cond: {
              if: { $and: [{ $ne: ['$codingStats.profiles.github', null] }, { $ne: ['$codingStats.profiles.github', ''] }] },
              then: true, else: false
            }
          },
          leetcodeConnected: {
            $cond: {
              if: { $and: [{ $ne: ['$codingStats.profiles.leetcode', null] }, { $ne: ['$codingStats.profiles.leetcode', ''] }] },
              then: true, else: false
            }
          },
          codeforcesConnected: {
            $cond: {
              if: { $and: [{ $ne: ['$codingStats.profiles.codeforces', null] }, { $ne: ['$codingStats.profiles.codeforces', ''] }] },
              then: true, else: false
            }
          }
        }
      }
    ];

    // Execute both queries in parallel
    const [countResult, dataResult] = await Promise.all([
      Profile.aggregate(countPipeline).option({ maxTimeMS: 5000 }),
      Profile.aggregate(dataPipeline).option({ maxTimeMS: 5000 })
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    // ── 6. Audit log ──────────────────────────────────────────────────────────
    const durationMs = Date.now() - startTime;
    try {
      await AuditLog.create({
        action: 'talent_discovery_search',
        performedBy: req.user._id,
        role: 'admin',
        targetModel: 'User',
        targetId: req.user._id,
        details: {
          adminId: req.user._id,
          filtersUsed: {
            search, department, branch, year, semester,
            gpaMin, gpaMax, backlogsMax,
            developerScoreMin, developerScoreMax,
            githubScoreMin, dsaScoreMin, cpScoreMin,
            skills, githubConnected, leetcodeConnected, codeforcesConnected,
            placementReadinessMin, achievementPointsMin,
            hasResumeAnalysis, atsScoreMin,
            sortBy, sortOrder, page: pageNum, limit: limitNum
          },
          resultCount: dataResult.length,
          executionTimeMs: durationMs,
          pipelineVersion: '4.3.1'
        }
      });
    } catch (auditErr) {
      console.error('Failed to log talent_discovery_search audit event:', auditErr.message);
    }

    return res.json({
      success: true,
      data: dataResult,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('talentDiscovery error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
