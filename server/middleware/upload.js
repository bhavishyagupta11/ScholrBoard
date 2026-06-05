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

export const uploadResumeToCloud = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const isPdf = req.file.mimetype === 'application/pdf';
    const result = await storeUpload(
      req,
      `scholrmind/resumes/${req.user._id}`,
      { resource_type: 'raw', ...(isPdf ? { format: 'pdf' } : {}) }
    );
    req.file.cloudinaryUrl      = result.secure_url;
    req.file.cloudinaryPublicId = result.public_id;
    next();
  } catch (error) {
    console.error('Cloudinary resume upload error:', error);
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
