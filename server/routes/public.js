import express from 'express';
import Activity from '../models/Activity.js';
import Opportunity from '../models/Opportunity.js';
import Event from '../models/Event.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';

const router = express.Router();

// In-memory cache to prevent redundant database queries under high concurrency (TTL: 60s)
let cachedMetrics = null;
let cacheExpiry = 0;

/**
 * @route   GET /api/public/metrics
 * @desc    Public aggregate telemetry counts for the landing page.
 *          Each count maps 1:1 to a specific collection status query.
 * @access  Public (No authentication required)
 */
router.get('/metrics', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedMetrics && now < cacheExpiry) {
      return res.json({
        success: true,
        data: cachedMetrics,
        cached: true,
      });
    }

    const [
      activitiesApproved,
      placementDrives,
      eventsPublished,
      resumesAnalyzed,
      facultyDecisions,
    ] = await Promise.all([
      // 1. Approved student activities in the Activity collection
      Activity.countDocuments({ status: 'Approved', isArchived: { $ne: true } }),

      // 2. Published/active placement drives in the Opportunity collection
      Opportunity.countDocuments({ status: { $ne: 'Archived' } }),

      // 3. Published events in the Event collection
      Event.countDocuments({ isArchived: { $ne: true } }),

      // 4. Completed AI ATS evaluations in the ResumeAnalysis collection
      ResumeAnalysis.countDocuments({ analysisStatus: 'completed' }),

      // 5. Total processed activity decisions (Approved, Rejected, Needs Revision) by faculty
      Activity.countDocuments({
        status: { $in: ['Approved', 'Rejected', 'Needs Revision'] },
        isArchived: { $ne: true },
      }),
    ]);

    const metrics = {
      activitiesApproved: activitiesApproved || 0,
      placementDrives: placementDrives || 0,
      eventsPublished: eventsPublished || 0,
      resumesAnalyzed: resumesAnalyzed || 0,
      facultyDecisions: facultyDecisions || 0,
    };

    cachedMetrics = metrics;
    cacheExpiry = now + 60 * 1000;

    return res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error in /api/public/metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve platform metrics',
    });
  }
});

export default router;
