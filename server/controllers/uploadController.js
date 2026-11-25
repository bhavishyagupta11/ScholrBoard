/**
 * uploadController.js — File upload endpoints
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';
import Application from '../models/Application.js';
import Activity from '../models/Activity.js';
import { validateResumeFile } from '../middleware/upload.js';
import { generateSignedCloudinaryUrl } from '../utils/cloudinaryHelper.js';
import { documentBufferCache } from '../utils/documentBufferCache.js';
import { resolveValidatedDocumentBuffer } from '../utils/documentDelivery.js';

const sendValidatedDocumentResult = (res, result, baseFilename = 'document') => {
  if (!result.ok) {
    if (result.json) {
      return res.status(result.status).json(result.json);
    }
    return res.status(result.status).send(result.text);
  }

  const filename = `${baseFilename}.${result.extension || 'pdf'}`;
  res.setHeader('Content-Type', result.contentType || 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  return res.send(result.buffer);
};

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
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No resume file provided' });
    }

    // If buffer is present, enforce binary content signature and format validation
    if (req.file.buffer) {
      const validation = validateResumeFile(req.file);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          code: validation.code,
          message: validation.message,
        });
      }
    }

    if (!req.file.cloudinaryUrl) {
      return res.status(400).json({ success: false, message: 'No resume file provided' });
    }

    // Check if user already has an active completed analysis
    const existingCurrent = await ResumeAnalysis.findOne({
      userId: req.user._id,
      isCurrent: true,
      analysisStatus: 'completed',
    });

    // Create new analysis record (analysis runs async via AI endpoint).
    // If a valid analysis exists, start new one with isCurrent: false to preserve
    // the prior analysis and score if the new analysis fails or is cancelled.
    const analysis = await ResumeAnalysis.create({
      userId:         req.user._id,
      fileUrl:        req.file.cloudinaryUrl,
      fileName:       req.file.originalname,
      fileSize:       req.file.size,
      mimeType:       req.file.mimetype,
      analysisStatus: 'pending',
      isCurrent:      existingCurrent ? false : true,
    });

    // Update profile resume URL only if user does not have an active completed analysis yet.
    // When an active analysis exists, we preserve its URL until new analysis successfully completes.
    if (!existingCurrent) {
      await Profile.findOneAndUpdate(
        { userId: req.user._id },
        { $set: { resumeUrl: req.file.cloudinaryUrl, resumeUpdatedAt: new Date() } },
        { upsert: true }
      );
    }

    // Cache the original upload buffer for resilient analysis & preview
    if (req.file.buffer) {
      documentBufferCache.set(req.user._id, req.file.cloudinaryUrl, req.file.buffer, req.file.mimetype);
      documentBufferCache.set(req.user._id, analysis._id.toString(), req.file.buffer, req.file.mimetype);
      if (req.file.cloudinaryPublicId) {
        documentBufferCache.set(req.user._id, req.file.cloudinaryPublicId, req.file.buffer, req.file.mimetype);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Resume uploaded successfully. AI analysis will begin shortly.',
      analysisId: analysis._id,
      fileUrl:    req.file.cloudinaryUrl,
    });
  } catch (error) {
    console.error('uploadResume error:', error.message);
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

    // Cache the validated upload buffer for extraction & preview independence
    if (req.file.buffer) {
      documentBufferCache.set(req.user._id, req.file.cloudinaryUrl, req.file.buffer, req.file.mimetype);
      if (req.file.cloudinaryPublicId) {
        documentBufferCache.set(req.user._id, req.file.cloudinaryPublicId, req.file.buffer, req.file.mimetype);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Certificate uploaded successfully.',
      fileUrl: req.file.cloudinaryUrl,
      url: req.file.cloudinaryUrl,
      mimetype: req.file.mimetype,
      extractionStatus: 'pending'
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
    const analysis = await ResumeAnalysis.findById(req.params.id);

    if (!analysis) {
      return res.status(404).json({ success: false, message: 'Analysis not found' });
    }

    const isOwner = analysis.userId && analysis.userId.toString() === req.user._id.toString();
    const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to access this resume analysis' });
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
    const { id } = req.params;
    let resumeUrl = null;
    let ownerUserId = null;

    // Check Application first
    const application = await Application.findById(id);
    if (application) {
      const studentId = application.studentId || application.student || application.userId;
      const isOwner = studentId && studentId.toString() === req.user._id.toString();
      const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
      if (!isOwner && !isPrivileged) {
        return res.status(403).send('Forbidden: You are not authorized to view this resume');
      }
      ownerUserId = studentId ? studentId.toString() : req.user._id.toString();
      resumeUrl = application.resumeUrl;
    } else {
      // Check ResumeAnalysis
      const analysis = await ResumeAnalysis.findById(id);
      if (analysis) {
        const isOwner = analysis.userId && analysis.userId.toString() === req.user._id.toString();
        const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
        if (!isOwner && !isPrivileged) {
          return res.status(403).send('Forbidden: You are not authorized to view this resume');
        }
        ownerUserId = analysis.userId ? analysis.userId.toString() : req.user._id.toString();
        resumeUrl = analysis.fileUrl;
      } else {
        // Check Profile
        const profile = await Profile.findById(id);
        if (profile) {
          const isOwner = profile.userId && profile.userId.toString() === req.user._id.toString();
          const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
          if (!isOwner && !isPrivileged) {
            return res.status(403).send('Forbidden: You are not authorized to view this resume');
          }
          ownerUserId = profile.userId ? profile.userId.toString() : req.user._id.toString();
          resumeUrl = profile.resumeUrl;
        } else {
          return res.status(404).send('Application not found');
        }
      }
    }

    if (!resumeUrl) {
      return res.status(404).send('Resume URL is empty');
    }

    const result = await resolveValidatedDocumentBuffer({
      ownerUserId: ownerUserId || req.user._id.toString(),
      identifierKeys: [resumeUrl, id],
      assetUrl: resumeUrl,
      allowImages: false,
      preferPrivateDownload: false,
      preserveHttpStatus: true,
    });
    return sendValidatedDocumentResult(res, result, 'resume');
  } catch (error) {
    console.error('viewResumeFile error:', error);
    return res.status(500).send('Internal server error while viewing resume');
  }
};

// ─── GET certificate file as inline stream by DB subdocument ID ────────────────
export const viewCertificateFile = async (req, res) => {
  try {
    const { certId } = req.params;
    const profile = await Profile.findOne({ 'certifications._id': certId });
    if (!profile) {
      return res.status(404).send('Certificate not found');
    }

    const isOwner = profile.userId && profile.userId.toString() === req.user._id.toString();
    const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).send('Forbidden: You are not authorized to view this certificate');
    }

    const cert =
      typeof profile.certifications?.id === 'function'
        ? profile.certifications.id(certId)
        : (profile.certifications || []).find((c) => c._id?.toString() === certId.toString());

    const assetUrl = cert?.sourceFileUrl || cert?.credentialUrl;
    if (!assetUrl) {
      return res.status(404).send('Certificate document URL is empty');
    }

    const result = await resolveValidatedDocumentBuffer({
      ownerUserId: profile.userId ? profile.userId.toString() : req.user._id.toString(),
      identifierKeys: [assetUrl, certId],
      assetUrl,
      allowImages: true,
      preferPrivateDownload: true,
      preserveHttpStatus: false,
    });
    return sendValidatedDocumentResult(res, result, 'certificate');
  } catch (error) {
    console.error('viewCertificateFile error:', error);
    return res.status(500).send('Internal server error while viewing certificate');
  }
};

// ─── GET signed URL for authorized direct download/preview ───────────────────
export const getSignedResumeUrl = async (req, res) => {
  try {
    const { id } = req.params;

    // Check ResumeAnalysis first
    let canonicalUrl = null;
    const analysis = await ResumeAnalysis.findById(id);

    if (analysis) {
      const isOwner = analysis.userId && analysis.userId.toString() === req.user._id.toString();
      const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
      if (!isOwner && !isPrivileged) {
        return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to access this resume URL' });
      }
      canonicalUrl = analysis.fileUrl;
    } else {
      // Check Application
      const application = await Application.findById(id);
      if (application) {
        const studentId = application.studentId || application.student || application.userId;
        const isOwner = studentId && studentId.toString() === req.user._id.toString();
        const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
        if (!isOwner && !isPrivileged) {
          return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to access this resume URL' });
        }
        canonicalUrl = application.resumeUrl;
      } else {
        // Check Profile
        const profile = await Profile.findById(id);
        if (profile) {
          const isOwner = profile.userId && profile.userId.toString() === req.user._id.toString();
          const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
          if (!isOwner && !isPrivileged) {
            return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to access this resume URL' });
          }
          canonicalUrl = profile.resumeUrl;
        } else {
          return res.status(404).json({ success: false, message: 'Resume document not found' });
        }
      }
    }

    if (!canonicalUrl) {
      return res.status(404).json({ success: false, message: 'Resume URL is empty' });
    }

    if (!canonicalUrl.startsWith('http')) {
      return res.status(400).json({ success: false, message: 'Local files do not require signed Cloudinary URLs' });
    }

    const { signedUrl, expiresAt } = generateSignedCloudinaryUrl(canonicalUrl, { expiresIn: 300 });

    return res.json({
      success: true,
      signedUrl,
      expiresAt,
    });
  } catch (error) {
    console.error('getSignedResumeUrl error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate signed resume URL' });
  }
};

// ─── GET generic PDF file as inline stream (Global PDF proxy) ────────────────
export const proxyPdf = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).send('Authentication required');
    }

    const rawUrl = req.query.url;
    if (!rawUrl) {
      return res.status(400).send('URL is required');
    }

    // 0. Domain, Scheme, and Path validation (SSRF Protection)
    let isCloudinary = false;
    let cleanLocalPath = null;

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      if (!rawUrl.startsWith('https://')) {
        return res.status(400).send('Invalid document URL source');
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        return res.status(400).send('Invalid document URL source');
      }

      // Disallow user-info tricks (e.g. https://res.cloudinary.com@attacker.com)
      if (parsedUrl.username || parsedUrl.password) {
        return res.status(400).send('Invalid document URL source');
      }

      // Exact hostname validation: strictly res.cloudinary.com
      const hostname = parsedUrl.hostname.toLowerCase();
      if (hostname !== 'res.cloudinary.com') {
        return res.status(400).send('Invalid document URL source');
      }

      // Reject non-standard ports
      if (parsedUrl.port && parsedUrl.port !== '443') {
        return res.status(400).send('Invalid document URL source');
      }

      // Validate Cloudinary cloud name against configuration if set
      const expectedCloud = process.env.CLOUDINARY_CLOUD_NAME;
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      const urlCloudName = pathSegments[0];
      const allowedClouds = ['demo', 'test-cloud', expectedCloud].filter(Boolean);
      if (expectedCloud && expectedCloud !== 'your_cloud_name' && !allowedClouds.includes(urlCloudName)) {
        return res.status(400).send('Invalid document URL source');
      }

      isCloudinary = true;
    } else {
      // Local path validation: must not contain protocol, traversal, or control characters
      if (rawUrl.includes('://') || rawUrl.includes('..') || rawUrl.includes('\0')) {
        return res.status(400).send('Invalid document URL source');
      }
      const stripped = rawUrl.replace(/^\/+/, '');
      if (stripped.startsWith('uploads/')) {
        cleanLocalPath = stripped;
      } else {
        return res.status(400).send('Invalid document URL source');
      }
    }

    // 0.1 Cross-tenant authorization check for user-partitioned documents
    let resolvedOwnerId = null;
    const userMatch = rawUrl.match(/(?:scholrmind|uploads)\/(?:resumes|certificates|activity-proofs)\/([a-f0-9]{24})/i);
    if (userMatch) {
      const targetUserId = userMatch[1].toLowerCase();
      resolvedOwnerId = targetUserId;
      const isOwner = targetUserId === req.user._id.toString().toLowerCase();
      const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
      if (!isOwner && !isPrivileged) {
        return res.status(403).send('Forbidden: You are not authorized to view another user\'s document');
      }
    }

    // 0.2 Record-level resolution in MongoDB (possession of URL != authorization)
    if (mongoose.connection?.readyState === 1) {
      try {
        const [analysis, profile, certProfile, application, activity] = await Promise.all([
          ResumeAnalysis.findOne({ fileUrl: rawUrl }).select('userId').lean(),
          Profile.findOne({ resumeUrl: rawUrl }).select('userId').lean(),
          Profile.findOne({
            $or: [
              { 'certifications.sourceFileUrl': rawUrl },
              { 'certifications.credentialUrl': rawUrl },
            ],
          })
            .select('userId')
            .lean(),
          Application.findOne({ resumeUrl: rawUrl }).select('studentId student userId').lean(),
          Activity.findOne({ proofUrl: rawUrl }).select('userId').lean(),
        ]);
        const record = analysis || profile || certProfile || application || activity;
        if (record) {
          const ownerId = record.userId || record.studentId || record.student;
          if (ownerId) {
            resolvedOwnerId = ownerId.toString().toLowerCase();
          }
          const isOwner = ownerId && ownerId.toString().toLowerCase() === req.user._id.toString().toLowerCase();
          const isPrivileged = ['admin', 'faculty'].includes(req.user.role);
          if (!isOwner && !isPrivileged) {
            return res.status(403).send('Forbidden: You are not authorized to view another user\'s document');
          }
        }
      } catch (dbLookupErr) {
        console.warn('[proxyPdf] Record authorization lookup warning:', dbLookupErr.message);
      }
    }

    // 0.3 Resolve via owner-scoped buffer cache -> local disk -> Cloudinary authenticated/signed fallback
    const result = await resolveValidatedDocumentBuffer({
      ownerUserId: resolvedOwnerId || req.user._id.toString(),
      identifierKeys: [rawUrl],
      assetUrl: rawUrl,
      allowImages: true,
      preferPrivateDownload: true,
      preserveHttpStatus: false,
      timeoutMs: 10000,
    });
    return sendValidatedDocumentResult(res, result, 'document');
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(504).send('Storage gateway timeout');
    }
    console.error('proxyPdf error:', error.message);
    return res.status(502).send('Failed to proxy storage document');
  }
};
