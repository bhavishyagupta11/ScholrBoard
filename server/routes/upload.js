import express from 'express';
import auth from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import {
  avatarUpload,
  resumeUpload,
  proofUpload,
  certificateUpload,
  uploadActivityProof,
  uploadResumeToCloud,
  uploadAvatarToCloud,
  uploadCertificateToCloud,
} from '../middleware/upload.js';
import {
  uploadAvatar,
  uploadResume,
  uploadActivityProofFile,
  uploadCertificate,
  getMyResumeAnalyses,
  getResumeAnalysis,
} from '../controllers/uploadController.js';

const router = express.Router();

router.use(auth);

// @route   POST /api/upload/avatar
// @desc    Upload profile picture
// Middleware chain: auth → multer (size+type check) → cloudinary upload → handler
router.post('/avatar',
  avatarUpload,
  uploadAvatarToCloud,
  uploadAvatar
);

// @route   POST /api/upload/resume
// @desc    Upload resume PDF
router.post('/resume',
  resumeUpload,
  uploadResumeToCloud,
  uploadResume
);

// @route   POST /api/upload/proof
// @desc    Upload activity proof (image or PDF)
router.post('/proof',
  proofUpload,
  uploadActivityProof,
  uploadActivityProofFile
);

// @route   POST /api/upload/certificate
// @desc    Upload a certificate image or PDF
router.post('/certificate',
  certificateUpload,
  uploadCertificateToCloud,
  uploadCertificate
);

// @route   GET /api/upload/resume/analyses
// @desc    Get all resume analyses for current user
router.get('/resume/analyses', getMyResumeAnalyses);

// @route   GET /api/upload/resume/analyses/:id
// @desc    Get a specific resume analysis
router.get('/resume/analyses/:id', validateObjectId('id'), getResumeAnalysis);

export default router;
