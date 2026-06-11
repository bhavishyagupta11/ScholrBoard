/**
 * eligibilityService.js — Automated Eligibility Matching Engine
 */

/**
 * Checks student profile against placement opportunity eligibility rules.
 * Returns { eligible: boolean, reason: string | null }
 */
export const evaluatePlacementEligibility = (studentUser, studentProfile, opportunity) => {
  const cgpa = studentProfile.gpa || 0.0;
  const semester = studentUser.semester || 1;
  const department = studentUser.department || '';
  const activeBacklogs = studentProfile.backlogs || 0; // default 0 if backlogs field isn't populated
  const readinessScore = studentProfile.placementReadinessScore || 0;

  const {
    minCGPA = 0.0,
    eligibleDepartments = [],
    minSemester = 1,
    maxActiveBacklogs = 0,
    minPlacementReadinessScore = null,
  } = opportunity.eligibility;

  if (cgpa < minCGPA) {
    return { eligible: false, reason: `GPA of ${cgpa.toFixed(2)} is below the minimum required ${minCGPA.toFixed(2)}` };
  }

  if (eligibleDepartments.length > 0 && department) {
    const isDeptMatched = eligibleDepartments.some(
      (dept) => dept.toLowerCase() === department.toLowerCase()
    );
    if (!isDeptMatched) {
      return { eligible: false, reason: `Department "${department}" is not eligible for this drive` };
    }
  }

  if (semester < minSemester) {
    return { eligible: false, reason: `Current semester (${semester}) is less than prerequisite semester ${minSemester}` };
  }

  if (activeBacklogs > maxActiveBacklogs) {
    return { eligible: false, reason: `Active backlogs (${activeBacklogs}) exceed the allowed maximum (${maxActiveBacklogs})` };
  }

  if (minPlacementReadinessScore !== null && readinessScore < minPlacementReadinessScore) {
    return { eligible: false, reason: `Placement Readiness Score of ${readinessScore} is below required ${minPlacementReadinessScore}` };
  }

  return { eligible: true, reason: null };
};

/**
 * Checks student profile against scholarship eligibility rules.
 * Returns { eligible: boolean, reason: string | null }
 */
export const evaluateScholarshipEligibility = (studentUser, studentProfile, scholarship, annualIncome = 0) => {
  const cgpa = studentProfile.gpa || 0.0;
  const department = studentUser.department || '';
  const points = studentProfile.achievementPoints || 0;

  const {
    minCGPA = 0.0,
    eligibleDepartments = [],
    minAchievementPoints = 0,
    maxAnnualIncome = null,
  } = scholarship.eligibility;

  if (cgpa < minCGPA) {
    return { eligible: false, reason: `GPA of ${cgpa.toFixed(2)} is below the minimum required ${minCGPA.toFixed(2)}` };
  }

  if (eligibleDepartments.length > 0 && department) {
    const isDeptMatched = eligibleDepartments.some(
      (dept) => dept.toLowerCase() === department.toLowerCase()
    );
    if (!isDeptMatched) {
      return { eligible: false, reason: `Department "${department}" is not eligible for this scholarship` };
    }
  }

  if (points < minAchievementPoints) {
    return { eligible: false, reason: `Achievement Points (${points}) are below the required ${minAchievementPoints} points` };
  }

  if (maxAnnualIncome !== null && annualIncome > maxAnnualIncome) {
    return { eligible: false, reason: `Declared annual income (₹${annualIncome.toLocaleString()}) exceeds the limit of ₹${maxAnnualIncome.toLocaleString()}` };
  }

  return { eligible: true, reason: null };
};
