import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';

const FORMULA_VERSION = 'v2.0.0';
const SCORE_VERSION = 2;

/**
 * Calculates GitHub sub-score (0-100)
 */
export const calculateGithubScore = (metrics) => {
  if (!metrics) return 0;

  const publicRepos = metrics.effectiveRepositoryCount !== undefined 
    ? Number(metrics.effectiveRepositoryCount || 0) 
    : Number(metrics.publicRepos || 0);
  const followers = Number(metrics.followers || 0);
  const stars = Number(metrics.stars || 0);
  const forks = Number(metrics.forks || 0);
  const topics = Array.isArray(metrics.topics) ? metrics.topics : [];

  // 1. Repo Points (Weight: 20%) - Max 100 points at 20 repos
  const repoPoints = Math.min(100, publicRepos * 5);

  // 2. Star Points (Weight: 40%) - Logarithmic scaling, max 100 points
  const starPoints = Math.min(100, (Math.log(stars + 1) / Math.log(1.5)) * 10);

  // 3. Fork Points (Weight: 20%) - Logarithmic scaling, max 100 points
  const forkPoints = Math.min(100, (Math.log(forks + 1) / Math.log(1.5)) * 15);

  // 4. Follower Points (Weight: 10%) - Max 100 points at 20 followers
  const followerPoints = Math.min(100, followers * 5);

  // 5. Project Quality (Weight: 10%) - Based on high-quality topics
  const qualityKeywords = ['react', 'node', 'machine-learning', 'kubernetes', 'docker', 'aws', 'gcp', 'nextjs', 'typescript', 'mongodb', 'postgresql', 'express', 'vue', 'angular', 'python', 'django'];
  const matchingTopics = topics.filter(topic => 
    qualityKeywords.includes(String(topic || '').toLowerCase())
  );
  const qualityPoints = Math.min(100, matchingTopics.length * 20);

  // Weighted sum
  const total = (repoPoints * 0.2) + 
                (starPoints * 0.4) + 
                (forkPoints * 0.2) + 
                (followerPoints * 0.1) + 
                (qualityPoints * 0.1);

  return Math.round(Math.min(100, Math.max(0, total)));
};

/**
 * Calculates LeetCode / DSA sub-score (0-100)
 */
export const calculateDsaScore = (metrics) => {
  if (!metrics) return 0;

  const easySolved = Number(metrics.easySolved || 0);
  const mediumSolved = Number(metrics.mediumSolved || 0);
  const hardSolved = Number(metrics.hardSolved || 0);
  const contestRating = Number(metrics.contestRating || 0);

  // 1. Easy Points (Weight: 20%) - Capped at 100 easy solved
  const easyPoints = Math.min(100, (easySolved / 100) * 100);

  // 2. Medium + Hard Points (Weight: 30%) - Medium=1.0, Hard=2.5, Capped at 150 points-equivalent
  const medHardVal = (mediumSolved * 1.0) + (hardSolved * 2.5);
  const medHardPoints = Math.min(100, (medHardVal / 150) * 100);

  // 3. Contest Points (Weight: 50%) - Rating starts at 1000, maxes at 2000
  let contestPoints = 0;
  if (contestRating > 1000) {
    contestPoints = Math.min(100, ((contestRating - 1000) / 1000) * 100);
  }

  // Weighted sum
  const total = (easyPoints * 0.20) + 
                (medHardPoints * 0.30) + 
                (contestPoints * 0.50);

  return Math.round(Math.min(100, Math.max(0, total)));
};

/**
 * Calculates Codeforces / CP sub-score (0-100)
 */
export const calculateCpScore = (metrics) => {
  if (!metrics) return 0;

  const rating = Number(metrics.rating || 0);
  const lastContestAt = metrics.lastContestAt;

  // Starts at 800 rating, maxes at 2000 rating
  let points = 0;
  if (rating > 800) {
    points = Math.min(100, ((rating - 800) / 1200) * 100);
  }

  // Apply activity decay if lastContestAt is present
  if (lastContestAt) {
    const diffMs = Date.now() - new Date(lastContestAt).getTime();
    const diffMonths = diffMs / (30 * 24 * 60 * 60 * 1000);

    let decayFactor = 1.0;
    if (diffMonths > 24) {
      decayFactor = 0.50;
    } else if (diffMonths > 12) {
      decayFactor = 0.75;
    } else if (diffMonths > 6) {
      decayFactor = 0.90;
    }

    points = points * decayFactor;
  }

  return Math.round(Math.min(100, Math.max(0, points)));
};

/**
 * Calculates Unified Developer Score (0-100) with dynamic normalization
 */
export const calculateUnifiedScore = (profile) => {
  if (!profile) return { score: 0, breakdown: {} };

  const githubUser = profile.codingStats?.profiles?.github;
  const leetcodeUser = profile.codingStats?.profiles?.leetcode;
  const cfUser = profile.codingStats?.profiles?.codeforces;

  const hasGithub = !!String(githubUser || '').trim();
  const hasLeetcode = !!String(leetcodeUser || '').trim();
  const hasCf = !!String(cfUser || '').trim();

  const gScore = Number(profile.githubScore || 0);
  const dsaScore = Number(profile.dsaScore || 0);
  const cpScore = Number(profile.cpScore || 0);

  let sum = 0;
  let denominator = 0;

  let githubWeightUsed = 0;
  let dsaWeightUsed = 0;
  let cpWeightUsed = 0;

  // GitHub: Weight = 0.30
  if (hasGithub) {
    sum += gScore * 0.30;
    denominator += 0.30;
    githubWeightUsed = 0.30;
  }

  // LeetCode: Weight = 0.35
  if (hasLeetcode) {
    sum += dsaScore * 0.35;
    denominator += 0.35;
    dsaWeightUsed = 0.35;
  }

  // Codeforces: Weight = 0.20
  if (hasCf) {
    sum += cpScore * 0.20;
    denominator += 0.20;
    cpWeightUsed = 0.20;
  }

  // Base platform score
  let baseScore = 0;
  if (denominator > 0) {
    baseScore = sum / denominator;
  }

  // Bonuses
  // Academic points bonus: 0.1 points per achievementPoint, max 8 points
  const achievementPoints = Number(profile.achievementPoints || 0);
  const achievementBonus = Math.min(8, achievementPoints * 0.1);

  // Placement readiness bonus: 0.02 points per placementReadinessScore, max 2 points
  const readinessScore = Number(profile.placementReadinessScore || 0);
  const readinessBonus = Math.min(2, readinessScore * 0.02);

  const finalScore = Math.round(Math.min(100, Math.max(0, baseScore + achievementBonus + readinessBonus)));

  return {
    score: finalScore,
    breakdown: {
      githubWeight: githubWeightUsed,
      dsaWeight: dsaWeightUsed,
      cpWeight: cpWeightUsed,
      achievementBonus: Number(achievementBonus.toFixed(2)),
      readinessBonus: Number(readinessBonus.toFixed(2)),
    }
  };
};

/**
 * Calculates and caches scores inside a profile document.
 * Triggered on sync completion, academic points update, etc.
 */
export const recalculateAndSaveScore = async (profileId, reason) => {
  const profile = await Profile.findById(profileId);
  if (!profile) {
    throw new Error(`Profile not found for ID: ${profileId}`);
  }

  const raw = profile.codingStats?.rawMetrics || {};
  
  // Calculate platform scores
  profile.githubScore = calculateGithubScore(raw.github);
  profile.dsaScore = calculateDsaScore(raw.leetcode);
  profile.cpScore = calculateCpScore(raw.codeforces);

  // Calculate unified score
  const { score, breakdown } = calculateUnifiedScore(profile);
  profile.developerScore = score;
  profile.scoreBreakdown = breakdown;

  // Metadata
  profile.developerScoreVersion = SCORE_VERSION;
  profile.scoringFormulaVersion = FORMULA_VERSION;
  profile.lastScoreCalculatedAt = new Date();
  profile.lastScoreCalculationReason = String(reason || 'manual recalculation').slice(0, 150);

  await profile.save();

  // Create AuditLog for score recalculation
  try {
    await AuditLog.create({
      action: 'developer_score_recalculated',
      performedBy: profile.userId,
      role: 'student',
      targetModel: 'User',
      targetId: profile.userId,
      details: {
        reason,
        developerScore: score,
        scoreBreakdown: breakdown,
        githubScore: profile.githubScore,
        dsaScore: profile.dsaScore,
        cpScore: profile.cpScore,
      }
    });
  } catch (auditErr) {
    console.error('Failed to create developer_score_recalculated audit log:', auditErr.message);
  }

  return profile;
};
