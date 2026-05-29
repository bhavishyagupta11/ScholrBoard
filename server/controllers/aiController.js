/**
 * aiController.js — Gemini AI integration
 *
 * All AI endpoints:
 *   1. POST /api/ai/chat          — multi-turn conversational AI
 *   2. POST /api/ai/recommend     — personalized learning recommendations
 *   3. POST /api/ai/roadmap       — generate a custom learning roadmap
 *   4. POST /api/ai/resume-tips   — AI tips for a specific resume analysis
 *   5. GET  /api/ai/chats         — list user's chat history
 *   6. GET  /api/ai/chats/:id     — get a specific conversation
 *   7. DELETE /api/ai/chats/:id   — archive a conversation
 *
 * Personalization:
 *   Every Gemini prompt is enriched with the user's real profile data
 *   (skills, goals, activities, GPA) so AI responses are truly personal.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import mongoose from 'mongoose';
import AiChatHistory from '../models/AiChatHistory.js';
import Activity from '../models/Activity.js';
import Analytics from '../models/Analytics.js';
import Profile from '../models/Profile.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

// Initialize Gemini client (fails gracefully if key is missing)
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }
  return new GoogleGenerativeAI(apiKey);
};

const parseJsonResponse = (text) => {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
};

/** Safe Gemini response text — avoids crashes on blocked / malformed responses */
const extractGeminiText = (response) => {
  try {
    if (typeof response?.text === 'function') {
      return String(response.text() || '').trim();
    }
  } catch (e) {
    console.warn('[ai] Gemini response.text() failed:', e.message);
  }
  return '';
};

const MAX_CHAT_MESSAGE_CHARS = 8000;

/**
 * Gemini chat history must start with role "user" and must not end with a lone "user"
 * (the SDK appends the new user turn). Drop invalid prefix / orphan trailing user.
 */
const buildGeminiHistory = (messages) => {
  const mapped = (messages || [])
    .map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content ?? '').slice(0, 32000) }],
    }))
    .filter((h) => h.parts[0].text.length > 0);

  let start = mapped.findIndex((h) => h.role === 'user');
  if (start < 0) return [];
  let slice = mapped.slice(start);
  if (slice.length && slice[slice.length - 1].role === 'user') {
    slice = slice.slice(0, -1);
  }
  return slice;
};

const generateWithModelFallback = async ({ prompt, systemInstruction, json = false, parts = null }) => {
  const genAI = getGeminiClient();
  const errors = [];
  const models = [
    process.env.GEMINI_MODEL,
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ].filter(Boolean);

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        ...(systemInstruction ? { systemInstruction } : {}),
        ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      });
      const result = await model.generateContent(parts || prompt);
      const text = extractGeminiText(result.response);
      if (!text) {
        errors.push(`${modelName}: empty or blocked response`);
        continue;
      }
      return { text, result, modelName };
    } catch (error) {
      errors.push(`${modelName}: ${error.message}`);
    }
  }

  throw new Error(errors.join(' | '));
};

const buildAiFallback = (message, profile) => {
  const name = profile?.userId?.name || 'there';
  const skills = profile?.skills?.length ? ` I can see skills like ${profile.skills.slice(0, 5).join(', ')} in your profile.` : '';
  return `Hi ${name}. I could not reach the live Gemini service right now, but I saved your message and can still help you move forward.${skills}\n\nFor: "${message}"\n\nStart with one concrete next step, add evidence to your profile or resume, and come back once the AI service is available for deeper personalized analysis.`;
};

// Build a rich system context string from the user's real data
const buildUserContext = (profile, analytics) => {
  const user = profile?.userId;
  const lines = [
    `You are ScholrMind AI — a personalized academic assistant for university students.`,
    `Always give practical, actionable, encouraging responses tailored to this specific student.`,
    ``,
    `## Student Profile`,
    `Name: ${user?.name || 'Student'}`,
    `Role: ${user?.role || 'student'}`,
    `Department: ${user?.department || 'Not specified'}`,
    `Semester: ${user?.semester || 'Not specified'}`,
  ];

  if (profile?.gpa)     lines.push(`GPA: ${profile.gpa}`);
  if (profile?.bio)     lines.push(`Bio: ${profile.bio}`);
  if (profile?.careerGoal) lines.push(`Career Goal: ${profile.careerGoal}`);
  if (profile?.skills?.length) lines.push(`Skills: ${profile.skills.join(', ')}`);
  if (profile?.interests?.length) lines.push(`Interests: ${profile.interests.join(', ')}`);
  if (profile?.targetCompanies?.length) lines.push(`Target Companies: ${profile.targetCompanies.join(', ')}`);

  if (analytics) {
    lines.push(``, `## Academic Performance`);
    if (analytics.currentStreak) lines.push(`Current Study Streak: ${analytics.currentStreak} days`);
    if (analytics.weeklyStudyMinutes) lines.push(`Study Time This Week: ${Math.round(analytics.weeklyStudyMinutes / 60)} hours`);
    if (analytics.overallAttendance) lines.push(`Attendance: ${analytics.overallAttendance}%`);
    if (analytics.activitySummary) {
      lines.push(`Approved Activities: ${analytics.activitySummary.Approved || 0}`);
      lines.push(`Pending Activities: ${analytics.activitySummary.Pending || 0}`);
    }
  }

  if (profile?.codingStats?.leetcodeProblemsSolved) {
    lines.push(``, `## Coding Stats`);
    lines.push(`LeetCode Problems Solved: ${profile.codingStats.leetcodeProblemsSolved}`);
    if (profile.codingStats.leetcodeContestRating) {
      lines.push(`Contest Rating: ${profile.codingStats.leetcodeContestRating}`);
    }
  }

  return lines.join('\n');
};

const extractResumeText = async (buffer, mimeType) => {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    return pdfData.text;
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const docxData = await mammoth.extractRawText({ buffer });
    return docxData.value;
  }

  if (mimeType === 'application/msword') {
    throw new Error('Legacy .doc resume parsing is not supported. Please upload PDF or DOCX.');
  }

  throw new Error('Unsupported resume file type');
};

// ─── SEND a chat message ──────────────────────────────────────────────────────
export const sendChatMessage = async (req, res) => {
  let conversation = null;
  let profile = null;
  try {
    const { message, conversationId, type = 'general' } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    // Fetch user context in parallel
    const [profileDoc, latestAnalytics] = await Promise.all([
      Profile.findOne({ userId: req.user._id }).populate('userId', 'name role department semester'),
      Analytics.findOne({ userId: req.user._id, period: 'monthly' }).sort({ periodStart: -1 }),
    ]);
    profile = profileDoc;

    const rawConvId = conversationId && String(conversationId).trim();
    const useExisting = Boolean(rawConvId && mongoose.Types.ObjectId.isValid(rawConvId));

    const userContent = message.trim().slice(0, MAX_CHAT_MESSAGE_CHARS);

    // Find or create conversation
    if (useExisting) {
      conversation = await AiChatHistory.findOne({
        _id: rawConvId,
        userId: req.user._id,
        isArchived: false,
      });
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }
    } else {
      conversation = await AiChatHistory.create({
        userId: req.user._id,
        type,
        title: message.trim().slice(0, 60) + (message.trim().length > 60 ? '...' : ''),
        messages: [],
      });
    }

    // Build Gemini history from stored messages (validated for SDK rules)
    const systemContext = buildUserContext(profile, latestAnalytics);
    const historyForGemini = buildGeminiHistory(conversation.messages);

    let aiResponse = '';
    let usageTokens = 0;
    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        systemInstruction: systemContext,
      });
      const chat = model.startChat({ history: historyForGemini });
      const result = await chat.sendMessage(userContent);
      aiResponse = extractGeminiText(result.response);
      usageTokens = result.response.usageMetadata?.totalTokenCount || 0;
    } catch (e) {
      console.warn('[ai] Primary chat path failed, using fallback models:', e.message);
      const { text, result } = await generateWithModelFallback({
        prompt: `${systemContext}\n\nStudent message: ${userContent}`,
      });
      aiResponse = text;
      usageTokens = result.response.usageMetadata?.totalTokenCount || 0;
    }

    if (!aiResponse) {
      aiResponse = buildAiFallback(userContent, profile);
    }

    aiResponse = aiResponse.slice(0, MAX_CHAT_MESSAGE_CHARS);

    conversation.messages.push(
      { role: 'user',  content: userContent },
      { role: 'model', content: aiResponse }
    );
    conversation.messageCount = conversation.messages.length;
    if (usageTokens) conversation.totalTokensUsed += usageTokens;
    await conversation.save();

    return res.json({
      success: true,
      response: aiResponse,
      conversationId: conversation._id,
      messageCount: conversation.messageCount,
    });
  } catch (error) {
    if (conversation) {
      try {
        const fallback = buildAiFallback(String(req.body.message || '').trim(), profile).slice(0, MAX_CHAT_MESSAGE_CHARS);
        const userLine = String(req.body.message || '').trim().slice(0, MAX_CHAT_MESSAGE_CHARS);
        await AiChatHistory.updateOne(
          { _id: conversation._id, userId: req.user._id },
          {
            $push: {
              messages: {
                $each: [
                  { role: 'user', content: userLine },
                  { role: 'model', content: fallback },
                ],
              },
            },
            $inc: { messageCount: 2 },
          }
        );
        const updated = await AiChatHistory.findById(conversation._id).select('messageCount');
        return res.json({
          success: true,
          degraded: true,
          response: fallback,
          conversationId: conversation._id,
          messageCount: updated?.messageCount ?? 0,
        });
      } catch (persistErr) {
        console.error('[ai] Failed to persist fallback chat:', persistErr);
      }
    }
    console.error('sendChatMessage error:', error);
    return res.status(500).json({ success: false, message: 'AI request failed. Please try again.' });
  }
};

// ─── GET personalized recommendations ────────────────────────────────────────
export const getPersonalizedRecommendations = async (req, res) => {
  try {
    const [profile, recentActivities] = await Promise.all([
      Profile.findOne({ userId: req.user._id }).populate('userId', 'name role department semester'),
      Activity.find({ userId: req.user._id, isArchived: false })
        .sort({ createdAt: -1 }).limit(5).select('title category status'),
    ]);

    const systemContext = buildUserContext(profile, null);
    const recentActivityStr = recentActivities.length
      ? `Recent activities: ${recentActivities.map((a) => `${a.title} (${a.status})`).join(', ')}`
      : 'No recent activities submitted.';

    const prompt = `
Based on this student's profile and recent activities, provide exactly 4 personalized recommendations.
${recentActivityStr}

Format your response as a JSON array with this exact structure:
[
  {
    "text": "Specific actionable recommendation",
    "priority": "high|medium|low",
    "category": "academic|coding|career|activities|wellness"
  }
]
Return ONLY the JSON array, no other text.`;

    const { text } = await generateWithModelFallback({ prompt, systemInstruction: systemContext, json: true });
    let recommendations = [];

    try {
      recommendations = parseJsonResponse(text);
    } catch {
      // If JSON parsing fails, return a safe fallback
      recommendations = [
        { text: 'Complete your profile to get personalized AI recommendations.', priority: 'high', category: 'academic' },
      ];
    }

    return res.json({ success: true, recommendations });
  } catch (error) {
    console.error('getPersonalizedRecommendations error:', error);
    return res.json({
      success: true,
      degraded: true,
      recommendations: [
        { text: 'Complete your profile and add recent activities for stronger recommendations.', priority: 'high', category: 'academic' },
        { text: 'Sync at least one coding profile so your technical growth can be tracked.', priority: 'medium', category: 'coding' },
        { text: 'Upload your latest resume to unlock ATS scoring and gap analysis.', priority: 'medium', category: 'career' },
        { text: 'Log a short study session today to build streak-based learning analytics.', priority: 'low', category: 'wellness' },
      ],
    });
  }
};

// ─── GENERATE a learning roadmap ──────────────────────────────────────────────
export const generateLearningRoadmap = async (req, res) => {
  try {
    const { goal, timeframeWeeks = 12 } = req.body;

    if (!goal) {
      return res.status(400).json({ success: false, message: 'Learning goal is required' });
    }

    const profile = await Profile.findOne({ userId: req.user._id }).populate('userId', 'name role department semester');
    const systemContext = buildUserContext(profile, null);

    const prompt = `
Create a ${timeframeWeeks}-week learning roadmap to achieve: "${goal}"

Return a JSON object with this structure:
{
  "title": "Roadmap title",
  "overview": "2-3 sentence overview",
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "Week theme",
      "topics": ["Topic 1", "Topic 2"],
      "resources": ["Resource 1 with URL"],
      "milestone": "What to achieve by end of week",
      "estimatedHours": 5
    }
  ],
  "prerequisites": ["Prerequisite 1"],
  "finalOutcome": "What the student will be able to do"
}
Return ONLY the JSON, no other text.`;

    const { text } = await generateWithModelFallback({ prompt, systemInstruction: systemContext, json: true });
    let roadmap;
    try {
      roadmap = parseJsonResponse(text);
    } catch {
      return res.status(500).json({ success: false, message: 'AI returned malformed roadmap. Try again.' });
    }

    // Save as a chat history item so user can refer back to it
    await AiChatHistory.create({
      userId: req.user._id,
      type: 'roadmap',
      title: `Roadmap: ${goal.slice(0, 50)}`,
      messages: [
        { role: 'user',  content: `Generate a ${timeframeWeeks}-week roadmap for: ${goal}` },
        { role: 'model', content: JSON.stringify(roadmap, null, 2) },
      ],
      messageCount: 2,
    });

    return res.json({ success: true, roadmap });
  } catch (error) {
    console.error('generateLearningRoadmap error:', error);
    const goal = req.body.goal || 'your goal';
    return res.json({
      success: true,
      degraded: true,
      roadmap: {
        title: `Roadmap for ${goal}`,
        overview: 'Live AI generation is temporarily unavailable, so this fallback roadmap focuses on a steady weekly learning loop.',
        weeks: [
          { weekNumber: 1, theme: 'Foundation', topics: ['Clarify goal', 'Assess current skills'], resources: ['Official documentation and one beginner project'], milestone: 'Create a baseline plan', estimatedHours: 5 },
          { weekNumber: 2, theme: 'Practice', topics: ['Core concepts', 'Small exercises'], resources: ['Practice platform or course module'], milestone: 'Finish one small deliverable', estimatedHours: 6 },
          { weekNumber: 3, theme: 'Build', topics: ['Project work', 'Portfolio evidence'], resources: ['GitHub repository'], milestone: 'Publish one proof of work', estimatedHours: 8 },
          { weekNumber: 4, theme: 'Review', topics: ['Gaps', 'Resume/profile updates'], resources: ['ScholrMind profile and resume tools'], milestone: 'Update profile and next plan', estimatedHours: 4 },
        ],
        prerequisites: ['Consistent weekly schedule'],
        finalOutcome: 'A visible project or profile improvement aligned with your goal.',
      },
    });
  }
};

// ─── LIST user's conversations ────────────────────────────────────────────────
export const listConversations = async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const query = { userId: req.user._id, isArchived: false };
    if (type) query.type = type;

    const skip = (Number(page) - 1) * Number(limit);

    const [conversations, total] = await Promise.all([
      AiChatHistory.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('title type messageCount updatedAt createdAt isPinned totalTokensUsed'),
      AiChatHistory.countDocuments(query),
    ]);

    return res.json({
      success: true,
      conversations,
      pagination: { currentPage: Number(page), totalPages: Math.ceil(total / Number(limit)), totalItems: total },
    });
  } catch (error) {
    console.error('listConversations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
};

// ─── GET a specific conversation with full messages ───────────────────────────
export const getConversation = async (req, res) => {
  try {
    const conversation = await AiChatHistory.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    return res.json({ success: true, conversation });
  } catch (error) {
    console.error('getConversation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch conversation' });
  }
};

/** Apply Gemini resume JSON onto a ResumeAnalysis doc (avoids Object.assign poisoning from extra keys). */
const applyResumeAnalysisFromAi = (analysisDoc, env) => {
  if (!env || typeof env !== 'object') return;
  const clamp100 = (n) => {
    const x = Number(n);
    if (Number.isNaN(x)) return null;
    return Math.min(100, Math.max(0, x));
  };

  if (env.overallScore != null) analysisDoc.overallScore = clamp100(env.overallScore);
  if (env.atsScore != null) analysisDoc.atsScore = clamp100(env.atsScore);
  if (env.summary != null) analysisDoc.summary = String(env.summary).slice(0, 2000);
  if (Array.isArray(env.strengths)) analysisDoc.strengths = env.strengths.map(String).slice(0, 30);
  if (Array.isArray(env.improvements)) analysisDoc.improvements = env.improvements.map(String).slice(0, 30);
  if (Array.isArray(env.skillsDetected)) analysisDoc.skillsDetected = env.skillsDetected.map(String).slice(0, 50);
  if (Array.isArray(env.skillGaps)) {
    analysisDoc.skillGaps = env.skillGaps
      .filter((g) => g && g.skill)
      .map((g) => ({
        skill: String(g.skill).slice(0, 120),
        importance: ['high', 'medium', 'low'].includes(g.importance) ? g.importance : 'medium',
        suggestion: g.suggestion ? String(g.suggestion).slice(0, 500) : '',
      }))
      .slice(0, 25);
  }
  if (Array.isArray(env.sectionFeedback)) {
    analysisDoc.sectionFeedback = env.sectionFeedback
      .filter((s) => s && s.section)
      .map((s) => ({
        section: String(s.section).slice(0, 80),
        score: Math.min(10, Math.max(0, Number(s.score) || 0)),
        feedback: s.feedback ? String(s.feedback).slice(0, 1000) : '',
        issues: Array.isArray(s.issues) ? s.issues.map(String).slice(0, 20) : [],
        tips: Array.isArray(s.tips) ? s.tips.map(String).slice(0, 20) : [],
      }))
      .slice(0, 20);
  }
  if (Array.isArray(env.recommendedRoles)) analysisDoc.recommendedRoles = env.recommendedRoles.map(String).slice(0, 20);
  if (Array.isArray(env.keywordsToAdd)) analysisDoc.keywordsToAdd = env.keywordsToAdd.map(String).slice(0, 40);

  if (env.parsedData && typeof env.parsedData === 'object') {
    const p = env.parsedData;
    analysisDoc.parsedData = {
      name: p.name != null ? String(p.name).slice(0, 200) : analysisDoc.parsedData?.name,
      email: p.email != null ? String(p.email).slice(0, 200) : analysisDoc.parsedData?.email,
      phone: p.phone != null ? String(p.phone).slice(0, 40) : analysisDoc.parsedData?.phone,
      links: Array.isArray(p.links) ? p.links.map(String).filter(Boolean).slice(0, 30) : [],
      education: Array.isArray(p.education) ? p.education.slice(0, 15) : [],
      experience: Array.isArray(p.experience) ? p.experience.slice(0, 20) : [],
      projects: Array.isArray(p.projects) ? p.projects.slice(0, 25) : [],
      certifications: Array.isArray(p.certifications) ? p.certifications.slice(0, 20) : [],
      achievements: Array.isArray(p.achievements) ? p.achievements.map(String).slice(0, 30) : [],
      technologies: Array.isArray(p.technologies) ? p.technologies.map(String).slice(0, 60) : [],
    };
  }
};

// ─── ARCHIVE a conversation ───────────────────────────────────────────────────
export const archiveConversation = async (req, res) => {
  try {
    const conversation = await AiChatHistory.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { isArchived: true } },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    return res.json({ success: true, message: 'Conversation archived' });
  } catch (error) {
    console.error('archiveConversation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to archive conversation' });
  }
};

// ─── ANALYZE a Resume ────────────────────────────────────────────────────────
export const analyzeResume = async (req, res) => {
  try {
    const { analysisId } = req.body;
    if (!analysisId) return res.status(400).json({ success: false, message: 'analysisId required' });

    const analysis = await ResumeAnalysis.findOne({ _id: analysisId, userId: req.user._id });
    if (!analysis) return res.status(404).json({ success: false, message: 'Resume analysis not found' });

    if (analysis.analysisStatus === 'completed') {
      return res.json({ success: true, analysis });
    }

    // Mark as processing
    analysis.analysisStatus = 'processing';
    await analysis.save();

    const startTime = Date.now();

    // 1. Fetch PDF buffer from Cloudinary
    const pdfResponse = await fetch(analysis.fileUrl);
    if (!pdfResponse.ok) throw new Error('Failed to fetch PDF from storage');
    const arrayBuffer = await pdfResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Parse resume text
    const textContent = await extractResumeText(buffer, analysis.mimeType);
    analysis.extractedText = String(textContent || '').slice(0, 20000);

    // 3. Construct Gemini Prompt
    const prompt = `
You are an expert ATS (Applicant Tracking System) and Career Coach. 
Analyze the following resume text and provide a highly detailed, structured evaluation.

RESUME TEXT:
${textContent.substring(0, 15000)}

Provide the evaluation exactly in this JSON structure:
{
  "parsedData": {
    "name": "Candidate name or null",
    "email": "email or null",
    "phone": "phone or null",
    "links": ["portfolio/github/linkedin URLs"],
    "education": [{"institution":"", "degree":"", "field":"", "year":""}],
    "experience": [{"company":"", "role":"", "duration":"", "highlights":[""]}],
    "projects": [{"name":"", "description":"", "technologies":[""], "links":[""]}],
    "certifications": [{"title":"", "issuer":"", "date":""}],
    "achievements": ["achievement"],
    "technologies": ["technology"]
  },
  "overallScore": 85,
  "atsScore": 80,
  "summary": "Executive summary...",
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Improvement 1", "Improvement 2"],
  "skillsDetected": ["React", "Node.js"],
  "skillGaps": [
    { "skill": "TypeScript", "importance": "high", "suggestion": "Learn basic types" }
  ],
  "sectionFeedback": [
    { "section": "Experience", "score": 7, "feedback": "Needs quantifiable metrics", "issues": ["No numbers"], "tips": ["Use XYZ formula"] }
  ],
  "recommendedRoles": ["Frontend Developer"],
  "keywordsToAdd": ["Agile", "REST API"]
}
Return ONLY valid JSON.
`;

    // 4. Call Gemini
    const { text: resumeJson } = await generateWithModelFallback({ prompt, json: true });
    const envelope = parseJsonResponse(resumeJson);

    // 5. Update Analysis Document (schema-safe merge only)
    applyResumeAnalysisFromAi(analysis, envelope);
    analysis.analysisStatus = 'completed';
    analysis.analysisDurationMs = Date.now() - startTime;
    await analysis.save();

    // 6. Update Profile Skills (Merge uniquely)
    const detectedSkills = [
      ...(envelope.skillsDetected || []),
      ...(envelope.parsedData?.technologies || []),
    ].filter(Boolean);
    const profileUpdate = {};
    const profileAddToSet = {};
    if (detectedSkills.length > 0) {
      profileAddToSet.skills = { $each: [...new Set(detectedSkills)].slice(0, 20) };
    }
    if (envelope.parsedData?.links?.length) {
      const github = envelope.parsedData.links.find((link) => /github\.com/i.test(link));
      const linkedin = envelope.parsedData.links.find((link) => /linkedin\.com/i.test(link));
      if (github) profileUpdate['socialLinks.github'] = github;
      if (linkedin) profileUpdate['socialLinks.linkedin'] = linkedin;
    }
    if (Object.keys(profileUpdate).length || Object.keys(profileAddToSet).length) {
      await Profile.findOneAndUpdate(
        { userId: req.user._id },
        {
          ...(Object.keys(profileUpdate).length ? { $set: profileUpdate } : {}),
          ...(Object.keys(profileAddToSet).length ? { $addToSet: profileAddToSet } : {}),
        },
        { upsert: true }
      );
    }

    return res.json({ success: true, analysis });

  } catch (error) {
    console.error('analyzeResume error:', error);
    if (req.body.analysisId) {
      await ResumeAnalysis.updateOne(
        { _id: req.body.analysisId },
        { $set: { analysisStatus: 'failed', analysisError: error.message } }
      );
    }
    return res.status(500).json({ success: false, message: 'Resume analysis failed', error: error.message });
  }
};

// ─── EXTRACT certificate details from uploaded file ──────────────────────────
export const extractCertificate = async (req, res) => {
  try {
    const { fileUrl, mimeType = 'image/jpeg' } = req.body;
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'fileUrl is required' });
    }

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error('Failed to fetch certificate from storage');

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    let promptInput;

    const prompt = `
Extract certificate data from this uploaded certificate.
Return ONLY valid JSON with this exact shape:
{
  "title": "Certificate title",
  "issuedBy": "Issuer or organization",
  "issuedDate": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "credentialId": "credential id or null",
  "skills": ["skill"],
  "technologies": ["technology"],
  "completionData": "short completion summary",
  "confidence": 0
}`;

    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      await parser.destroy();
      promptInput = `${prompt}\n\nCERTIFICATE TEXT:\n${pdfData.text.slice(0, 8000)}`;
    } else {
      promptInput = [
        prompt,
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType,
          },
        },
      ];
    }

    const { text: certJson } = await generateWithModelFallback({
      prompt: typeof promptInput === 'string' ? promptInput : prompt,
      parts: Array.isArray(promptInput) ? promptInput : null,
      json: true,
    });
    const extracted = parseJsonResponse(certJson);

    const cert = {
      title: extracted.title || 'Untitled Certificate',
      issuedBy: extracted.issuedBy || '',
      issuedDate: extracted.issuedDate ? new Date(extracted.issuedDate) : undefined,
      expiryDate: extracted.expiryDate ? new Date(extracted.expiryDate) : undefined,
      credentialId: extracted.credentialId || '',
      credentialUrl: fileUrl,
      sourceFileUrl: fileUrl,
      skills: Array.isArray(extracted.skills) ? extracted.skills : [],
      technologies: Array.isArray(extracted.technologies) ? extracted.technologies : [],
      extractionConfidence: Number(extracted.confidence || 0),
    };

    const skillsToAdd = [...new Set([...cert.skills, ...cert.technologies].filter(Boolean))].slice(0, 20);
    const profile = await Profile.findOneAndUpdate(
      { userId: req.user._id },
      {
        $push: { certifications: cert },
        ...(skillsToAdd.length ? { $addToSet: { skills: { $each: skillsToAdd } } } : {}),
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.json({
      success: true,
      message: 'Certificate extracted and added to profile',
      certificate: profile.certifications[profile.certifications.length - 1],
      skillsAdded: skillsToAdd,
    });
  } catch (error) {
    if (error.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ success: false, message: 'AI service not configured' });
    }
    console.error('extractCertificate error:', error);
    return res.status(500).json({ success: false, message: 'Certificate extraction failed', error: error.message });
  }
};
