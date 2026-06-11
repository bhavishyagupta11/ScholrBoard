import Profile from '../models/Profile.js';
import Activity from '../models/Activity.js';

/**
 * Calculates point allocation for an activity based on system rules.
 * Faculty Advisors cannot override these points.
 */
export const calculateActivityPoints = (activity) => {
  const category = activity.category;
  const subCategory = String(activity.subCategory || '').toLowerCase();
  const title = String(activity.title || '').toLowerCase();
  const description = String(activity.description || '').toLowerCase();

  // Rule 5: Patent (Research category + Patent keyword in title/desc/subCategory)
  if (
    category === 'Research' &&
    (subCategory.includes('patent') || title.includes('patent') || description.includes('patent'))
  ) {
    return 50;
  }

  // Rule 4: Research Paper (Research category)
  if (category === 'Research') {
    return 30;
  }

  // Rule 6: Hackathon Winner (Competitions category + Winner keyword in title/desc/subCategory)
  if (
    category === 'Competitions' &&
    (subCategory.includes('winner') || title.includes('winner') || description.includes('winner') ||
     subCategory.includes('1st') || title.includes('1st') || description.includes('1st') ||
     subCategory.includes('first') || title.includes('first') || description.includes('first'))
  ) {
    return 25;
  }

  // Rule 3: Internship (Internship category)
  if (category === 'Internship') {
    return 20;
  }

  // Rule 2: Certification (Certifications category)
  if (category === 'Certifications') {
    return 10;
  }

  // Rule 1: Workshop (Workshops category)
  if (category === 'Workshops') {
    return 5;
  }

  // Default points for other categories (Competitions, Volunteering, Sports, Cultural, etc.)
  return 5;
};

/**
 * Updates the student's profile cached achievementPoints by summing all approved activities.
 */
export const updateStudentPoints = async (userId, session = null) => {
  try {
    const aggregateQuery = Activity.aggregate([
      { $match: { userId, status: 'Approved', isArchived: false } },
      { $group: { _id: null, totalPoints: { $sum: '$points' } } },
    ]);
    if (session) aggregateQuery.session(session);

    const summary = await aggregateQuery;
    const totalPoints = summary[0]?.totalPoints || 0;

    await Profile.findOneAndUpdate(
      { userId },
      { $set: { achievementPoints: totalPoints } },
      { upsert: true, session }
    );

    return totalPoints;
  } catch (error) {
    console.error('Error updating student points in scoringService:', error);
    throw error;
  }
};
