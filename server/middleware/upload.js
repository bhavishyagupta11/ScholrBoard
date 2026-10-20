/**
 * upload.js middleware — Multer + Cloudinary file upload configuration
 *
 * Strategy:
 *   Files are uploaded to Cloudinary using multer's memory storage.
 *   We never write files to disk on the server.
 *   Each upload goes to a specific Cloudinary folder based on type.
 *
 * Security:
 *   - File type validation (MIME + extension)
 *   - File size limits enforced at middleware level
 *   - Files are private on Cloudinary by default
 */
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Initialize Cloudinary with env credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const cloudinaryConfigured = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  return Boolean(
    CLOUDINARY_CLOUD_NAME &&
    CLOUDINARY_API_KEY &&
    CLOUDINARY_API_SECRET &&
    !CLOUDINARY_CLOUD_NAME.startsWith('your_') &&
    !CLOUDINARY_API_KEY.startsWith('your_') &&
    !CLOUDINARY_API_SECRET.startsWith('your_')
  );
};

const extensionFor = (file) => {
  const fromName = path.extname(file.originalname || '').toLowerCase();
  if (fromName) return fromName;
  const byMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return byMime[file.mimetype] || '.bin';
};

const saveLocalUpload = async (req, folder) => {
  const uploadRoot = path.resolve(process.cwd(), 'uploads');
  const safeFolder = folder.replace(/^scholrmind\//, '').replace(/[^a-zA-Z0-9/_-]/g, '');
  const targetDir = path.join(uploadRoot, safeFolder);
  await fs.mkdir(targetDir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extensionFor(req.file)}`;
  const filePath = path.join(targetDir, filename);
  await fs.writeFile(filePath, req.file.buffer);

  const relativeUrl = `/uploads/${safeFolder}/${filename}`.replace(/\\/g, '/');
  const baseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  return {
    secure_url: `${baseUrl}${relativeUrl}`,
    public_id: relativeUrl,
  };
};

// ─── Multer config (memory storage — no disk writes) ─────────────────────────
const storage = multer.memoryStorage();

const fileFilter = (allowedMimes) => (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Invalid file type. Allowed: ${allowedMimes.join(', ')}`);
    error.statusCode = 400;
    cb(error, false);
  }
};

// Resume upload: PDF, DOC, DOCX — max 5 MB
export const resumeUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
}).single('resume');

// Profile image upload: JPEG, PNG, WebP — max 2 MB
export const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: fileFilter(['image/jpeg', 'image/png', 'image/webp']),
}).single('avatar');

// Activity proof upload: images + PDF — max 10 MB
export const proofUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter([
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
  ]),
}).single('proof');

// Certificate upload: images + PDF — max 10 MB
export const certificateUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter([
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
  ]),
}).single('certificate');

// ─── Cloudinary upload helper ─────────────────────────────────────────────────
/**
 * Upload a buffer to Cloudinary and return the secure URL.
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {string} folder - Cloudinary folder e.g. 'scholrmind/resumes'
 * @param {object} options - Additional Cloudinary upload options
 */
export const uploadToCloudinary = (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

const storeUpload = async (req, folder, options = {}) => {
  if (!cloudinaryConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cloudinary is not configured in production environment. Silent local disk fallback is prohibited.');
    }
    return saveLocalUpload(req, folder);
  }
  return uploadToCloudinary(req.file.buffer, folder, options);
};

/**
 * Middleware: upload to Cloudinary after multer processes the file.
 * Sets req.file.cloudinaryUrl and req.file.cloudinaryPublicId.
 *
 * Usage:
 *   router.post('/upload', proofUpload, uploadActivityProof, handler);
 */
export const uploadActivityProof = async (req, res, next) => {
  if (!req.file) return next();   // no file uploaded — handler will decide if required

  try {
    const result = await storeUpload(
      req,
      `scholrmind/activity-proofs/${req.user._id}`,
      { allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'] }
    );
    req.file.cloudinaryUrl      = result.secure_url;
    req.file.cloudinaryPublicId = result.public_id;
    next();
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return res.status(500).json({ success: false, message: 'File upload failed. Please try again.' });
  }
};

// ─── File Content Signature & Magic Byte Validation (V13 Part 14 & Phase 8) ───
/**
 * Detects the real format of a buffer based on binary file signatures (magic bytes).
 * @param {Buffer} buffer
 * @returns {'pdf'|'docx'|'doc'|'executable'|'script'|'unknown'}
 */
export function detectBufferFormat(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return 'unknown';
  }

  // 1. Check for malicious executable signatures
  // Windows PE: "MZ" (0x4D, 0x5A)
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return 'executable';
  }
  // Linux ELF: 0x7F, 'E', 'L', 'F' (0x7F, 0x45, 0x4C, 0x46)
  if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
    return 'executable';
  }
  // Mach-O: 0xFE, 0xED, 0xFA, 0xCE / 0xCF or 0xCA, 0xFE, 0xBA, 0xBE
  if ((buffer[0] === 0xFE && buffer[1] === 0xED && buffer[2] === 0xFA) ||
      (buffer[0] === 0xCA && buffer[1] === 0xFE && buffer[2] === 0xBA && buffer[3] === 0xBE)) {
    return 'executable';
  }

  // Check for shell scripts / HTML / PHP scripts
  const headerText = buffer.subarray(0, 128).toString('ascii').toLowerCase();
  if (headerText.startsWith('#!') || headerText.includes('<?php') || headerText.includes('<html') || headerText.includes('<script')) {
    return 'script';
  }

  // 2. Check for PDF:
  // Must contain "%PDF-" in the first 1024 bytes (0x25, 0x50, 0x44, 0x46, 0x2D)
  const searchLimit = Math.min(buffer.length, 1024);
  const pdfIndex = buffer.subarray(0, searchLimit).indexOf(Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]));
  if (pdfIndex !== -1) {
    return 'pdf';
  }

  // 3. Check for OLE2 Compound Document (DOC format):
  // Magic bytes: 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 (8 bytes)
  if (buffer.length >= 8 &&
      buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 &&
      buffer[4] === 0xA1 && buffer[5] === 0xB1 && buffer[6] === 0x1A && buffer[7] === 0xE1) {
    return 'doc';
  }

  // 4. Check for ZIP / OpenXML (DOCX format):
  // Magic bytes: 'PK\x03\x04' (0x50, 0x4B, 0x03, 0x04) or PK\x05\x06 or PK\x07\x08
  if (buffer[0] === 0x50 && buffer[1] === 0x4B &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
      (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)) {
    const sample = buffer.subarray(0, Math.min(buffer.length, 65536)).toString('binary');
    if (sample.includes('[Content_Types].xml') || sample.includes('word/') || sample.includes('word/document.xml')) {
      return 'docx';
    }
  }

  return 'unknown';
}

/**
 * Validates the uploaded resume file against V13 size, extension, MIME, and binary content signature rules.
 * @param {object} file - Express file object with buffer, mimetype, originalname, size
 * @returns {{ isValid: boolean, code: string|null, message: string|null }}
 */
export function validateResumeFile(file) {
  if (!file) {
    return { isValid: false, code: 'NO_FILE_PROVIDED', message: 'No file provided for upload.' };
  }

  const size = file.size ?? file.buffer?.length ?? 0;
  if (size <= 0) {
    return { isValid: false, code: 'EMPTY_FILE', message: 'Uploaded file is empty.' };
  }
  if (size < 32) {
    return { isValid: false, code: 'FILE_CORRUPTED_OR_TOO_SMALL', message: 'File is too small to be a valid document.' };
  }
  if (size > 5 * 1024 * 1024) {
    return { isValid: false, code: 'FILE_TOO_LARGE', message: 'File size exceeds 5MB limit.' };
  }

  const rawExt = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = new Set(['.pdf', '.docx', '.doc']);
  if (!allowedExts.has(rawExt)) {
    return {
      isValid: false,
      code: 'UNSUPPORTED_EXTENSION',
      message: `File extension "${rawExt}" is not allowed. Only .pdf, .docx, and .doc are permitted.`
    };
  }

  const allowedMimes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]);
  if (!allowedMimes.has(file.mimetype)) {
    return {
      isValid: false,
      code: 'UNSUPPORTED_MIME_TYPE',
      message: `MIME type "${file.mimetype}" is not supported for resume uploads.`
    };
  }

  // Check actual binary content signature when buffer is present
  if (file.buffer && Buffer.isBuffer(file.buffer)) {
    const detectedFormat = detectBufferFormat(file.buffer);

    if (detectedFormat === 'executable') {
      return {
        isValid: false,
        code: 'EXECUTABLE_REJECTED',
        message: 'Binary executable files are strictly prohibited.'
      };
    }
    if (detectedFormat === 'script') {
      return {
        isValid: false,
        code: 'SCRIPT_REJECTED',
        message: 'Script and text files are not accepted as valid resumes.'
      };
    }

    if (detectedFormat === 'pdf') {
      if (rawExt !== '.pdf' || file.mimetype !== 'application/pdf') {
        return {
          isValid: false,
          code: 'EXTENSION_MIME_MISMATCH',
          message: 'File content is PDF but extension or MIME type does not match.'
        };
      }
    } else if (detectedFormat === 'docx') {
      if (rawExt !== '.docx' || file.mimetype !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return {
          isValid: false,
          code: 'EXTENSION_MIME_MISMATCH',
          message: 'File content is DOCX but extension or MIME type does not match.'
        };
      }
    } else if (detectedFormat === 'doc') {
      if (rawExt !== '.doc' || file.mimetype !== 'application/msword') {
        return {
          isValid: false,
          code: 'EXTENSION_MIME_MISMATCH',
          message: 'File content is DOC but extension or MIME type does not match.'
        };
      }
    } else {
      return {
        isValid: false,
        code: 'INVALID_FILE_SIGNATURE',
        message: 'File content signature does not match any allowed format (.pdf, .docx, .doc).'
      };
    }
  }

  return { isValid: true, code: null, message: null };
}

export const uploadResumeToCloud = async (req, res, next) => {
  if (!req.file) return next();

  // Validate file signature, extension, MIME, and size before cloud storage
  const validation = validateResumeFile(req.file);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      code: validation.code,
      message: validation.message,
    });
  }

  try {
    const isPdf = req.file.mimetype === 'application/pdf';
    const result = await storeUpload(
      req,
      `scholrmind/resumes/${req.user._id}`,
      {
        resource_type: 'raw',
        type: 'authenticated', // Supported delivery type for private assets (prohibits unrestricted public CDN access)
        ...(isPdf ? { format: 'pdf' } : {}),
      }
    );
    req.file.cloudinaryUrl      = result.secure_url;
    req.file.cloudinaryPublicId = result.public_id;
    next();
  } catch (error) {
    console.error('Cloudinary resume upload error:', error.message);
    return res.status(500).json({ success: false, message: 'Resume upload failed. Please try again.' });
  }
};

export const uploadAvatarToCloud = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const result = await storeUpload(
      req,
      `scholrmind/avatars`,
      {
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
        public_id: `avatar_${req.user._id}`,  // deterministic ID so old versions are replaced
        overwrite: true,
      }
    );
    req.file.cloudinaryUrl      = result.secure_url;
    req.file.cloudinaryPublicId = result.public_id;
    next();
  } catch (error) {
    console.error('Cloudinary avatar upload error:', error);
    return res.status(500).json({ success: false, message: 'Avatar upload failed. Please try again.' });
  }
};

export const uploadCertificateToCloud = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const isPdf = req.file.mimetype === 'application/pdf';
    const result = await storeUpload(
      req,
      `scholrmind/certificates/${req.user._id}`,
      { 
        resource_type: isPdf ? 'raw' : 'image', 
        ...(isPdf && { format: 'pdf' }) 
      }
    );
    req.file.cloudinaryUrl      = result.secure_url;
    req.file.cloudinaryPublicId = result.public_id;
    next();
  } catch (error) {
    console.error('Cloudinary certificate upload error:', error);
    return res.status(500).json({ success: false, message: 'Certificate upload failed. Please try again.' });
  }
};

export default cloudinary;
