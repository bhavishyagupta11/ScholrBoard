import express from 'express';
import auth from '../middleware/auth.js';
import validateObjectId from '../middleware/validateObjectId.js';
import requireRole from '../middleware/roleAuth.js';
import {
  sendChatMessage,
  getPersonalizedRecommendations,
  generateLearningRoadmap,
  listConversations,
  getConversation,
  archiveConversation,
  analyzeResume,
  extractCertificate,
} from '../controllers/aiController.js';

const router = express.Router();

router.use(auth);

// @route   POST /api/ai/chat
// @desc    Send a message and get an AI response
router.post('/chat', sendChatMessage);

// @route   GET /api/ai/recommendations
// @desc    Get personalized AI recommendations based on user profile
router.get('/recommendations', getPersonalizedRecommendations);

// @route   POST /api/ai/roadmap
// @desc    Generate a custom learning roadmap
router.post('/roadmap', generateLearningRoadmap);

// @route   GET /api/ai/chats
// @desc    List user's AI conversation history
router.get('/chats', listConversations);

// @route   GET /api/ai/chats/:id
// @desc    Get a specific conversation with all messages
router.get('/chats/:id', validateObjectId('id'), getConversation);

// @route   DELETE /api/ai/chats/:id
// @desc    Archive (soft-delete) a conversation
router.delete('/chats/:id', validateObjectId('id'), archiveConversation);

// @route   POST /api/ai/analyze-resume
// @desc    Run full AI extraction and ATS scoring on an uploaded resume
router.post('/analyze-resume', analyzeResume);

// @route   POST /api/ai/extract-certificate
// @desc    OCR/extract certificate details with Gemini Vision/Flash
router.post('/extract-certificate', extractCertificate);

export default router;
