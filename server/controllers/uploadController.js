/**
 * uploadController.js — File upload endpoints
 */
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';
import Application from '../models/Application.js';

// ─── Upload profile avatar ─────────────────────────────────────────────────────
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file?.cloudinaryUrl) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Update avatar on User document
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatar: req.file.cloudinaryUrl } },
      { new: true }
    ).select('name email avatar');

    return res.json({
      success: true,
      message: 'Profile picture updated',
      avatarUrl: req.file.cloudinaryUrl,
      user,
    });
  } catch (error) {
    console.error('uploadAvatar error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile picture' });
  }
};

// ─── Upload resume ─────────────────────────────────────────────────────────────
export const uploadResume = async (req, res) => {
  try {
    if (!req.file?.cloudinaryUrl) {
      return res.status(400).json({ success: false, message: 'No resume file provided' });
    }

    // Mark all previous analyses as not current
    await ResumeAnalysis.updateMany(
      { userId: req.user._id, isCurrent: true },
      { $set: { isCurrent: false } }
    );

    // Create new analysis record (analysis runs async via AI endpoint)
    const analysis = await ResumeAnalysis.create({
      userId:         req.user._id,
      fileUrl:        req.file.cloudinaryUrl,
      fileName:       req.file.originalname,
      fileSize:       req.file.size,
      mimeType:       req.file.mimetype,
      analysisStatus: 'pending',
      isCurrent:      true,
    });

    // Update profile resume URL for quick access
    await Profile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { resumeUrl: req.file.cloudinaryUrl, resumeUpdatedAt: new Date() } },
      { upsert: true }
    );

    return res.status(201).json({
      success: true,
      message: 'Resume uploaded successfully. AI analysis will begin shortly.',
      analysisId: analysis._id,
      fileUrl:    req.file.cloudinaryUrl,
    });
  } catch (error) {
    console.error('uploadResume error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload resume' });
  }
};

// ─── Upload activity proof ─────────────────────────────────────────────────────
export const uploadActivityProofFile = async (req, res) => {
  try {
    if (!req.file?.cloudinaryUrl) {
      return res.status(400).json({ success: false, message: 'No proof file provided' });
    }

    return res.json({
      success: true,
      message: 'Proof uploaded',
      proofUrl: req.file.cloudinaryUrl,
      url: req.file.cloudinaryUrl,
    });
  } catch (error) {
    console.error('uploadActivityProofFile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload proof' });
  }
};

// ─── Upload certificate ────────────────────────────────────────────────────────
export const uploadCertificate = async (req, res) => {
  try {
    if (!req.file?.cloudinaryUrl) {
      return res.status(400).json({ success: false, message: 'No certificate file provided' });
    }

    return res.status(201).json({
      success: true,
      message: 'Certificate uploaded successfully.',
      fileUrl: req.file.cloudinaryUrl,
      url: req.file.cloudinaryUrl,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('uploadCertificate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload certificate' });
  }
};

// ─── GET resume analyses for current user ─────────────────────────────────────
export const getMyResumeAnalyses = async (req, res) => {
  try {
    const analyses = await ResumeAnalysis.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-extractedText -__v'); // skip large text field in list view

    return res.json({ success: true, analyses });
  } catch (error) {
    console.error('getMyResumeAnalyses error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch resume analyses' });
  }
};

// ─── GET a single resume analysis ─────────────────────────────────────────────
export const getResumeAnalysis = async (req, res) => {
  try {
    const analysis = await ResumeAnalysis.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    return res.json({ success: true, analysis });
  } catch (error) {
    console.error('getResumeAnalysis error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch analysis' });
  }
};

// ─── GET resume file as inline stream (Issue 5 Proxy) ───────────────────────────
export const viewResumeFile = async (req, res) => {
  try {
    const { id } = req.params; // Application ID
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).send('Application not found');
    }

    const { resumeUrl } = application;
    if (!resumeUrl) {
      return res.status(404).send('Resume URL is empty');
    }

    if (resumeUrl.startsWith('http')) {
      // Stream from Cloudinary
      const response = await fetch(resumeUrl);
      if (!response.ok) {
        return res.status(response.status).send('Failed to fetch file from storage');
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="resume.pdf"');
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } else {
      // Local file
      const path = await import('node:path');
      const fs = await import('node:fs/promises');
      const cleanUrl = resumeUrl.replace(/^\//, ''); // remove leading slash
      const absolutePath = path.resolve(process.cwd(), cleanUrl);
      try {
        await fs.access(absolutePath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="resume.pdf"');
        return res.sendFile(absolutePath);
      } catch {
        return res.status(404).send('Local resume file not found');
      }
    }
  } catch (error) {
    console.error('viewResumeFile error:', error);
    return res.status(500).send('Internal server error while viewing resume');
  }
};

// ─── GET generic PDF file as inline stream (Global PDF proxy) ────────────────
export const proxyPdf = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).send('URL is required');
    }

    if (!url.startsWith('http')) {
      return res.status(400).send('Invalid URL format');
    }

    // Enforce that we only proxy trusted domains (Cloudinary) to prevent SSRF
    if (!url.includes('res.cloudinary.com')) {
      // If it's not cloudinary, we can just redirect to it since it likely doesn't have the attachment issue
      return res.redirect(url);
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch file from storage');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    
    // We get it as an ArrayBuffer, convert to Buffer, and send
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (error) {
    console.error('proxyPdf error:', error);
    return res.status(500).send('Failed to proxy PDF file');
  }
};
