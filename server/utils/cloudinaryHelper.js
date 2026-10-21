/**
 * cloudinaryHelper.js
 *
 * ScholrBoard V13 Phase 8: Cloudinary URL Signing & Parsing Utilities.
 *
 * Enforces secure, time-limited signed URL generation for authenticated assets.
 * Guarantees that Cloudinary API credentials never leak to the client.
 */

import { v2 as defaultCloudinary } from 'cloudinary';

/**
 * Parses a canonical Cloudinary asset URL and generates an authorized, time-limited signed download URL.
 *
 * @param {string} assetUrl - Canonical Cloudinary asset URL (e.g. https://res.cloudinary.com/.../raw/authenticated/...)
 * @param {object} [options]
 * @param {number} [options.expiresIn=300] - Expiration duration in seconds (default 300s = 5 minutes).
 * @param {string} [options.resourceType] - Explicit override for resource_type ('raw' | 'image' | 'video').
 * @param {string} [options.deliveryType] - Explicit override for delivery tier ('authenticated' | 'upload' | 'private').
 * @param {object} [options.cloudinaryClient=defaultCloudinary] - Injected Cloudinary client for testing.
 * @returns {{ signedUrl: string, expiresAt: number, publicId: string, resourceType: string, deliveryType: string }}
 */
export function generateSignedCloudinaryUrl(assetUrl, {
  expiresIn = 300,
  resourceType: explicitResourceType,
  deliveryType: explicitDeliveryType,
  cloudinaryClient = defaultCloudinary,
} = {}) {
  if (!assetUrl || typeof assetUrl !== 'string') {
    throw new Error('Asset URL is required to generate signed URL');
  }

  if (assetUrl.startsWith('http://') || assetUrl.startsWith('https://')) {
    let parsed;
    try {
      parsed = new URL(assetUrl);
    } catch {
      throw new Error(`Malformed asset URL: ${assetUrl}`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`Invalid asset URL protocol: HTTPS required, received ${parsed.protocol}`);
    }
    if (parsed.hostname.toLowerCase() !== 'res.cloudinary.com') {
      throw new Error(`Unexpected Cloudinary host: ${parsed.hostname}`);
    }
  }

  // Extract resource_type, delivery_type, version, public_id
  const match = assetUrl.match(/\/(raw|image|video)\/(authenticated|private|upload)\/(?:s--[a-zA-Z0-9_.-]+--\/)?(?:v\d+\/)?(.+)$/);
  if (!match) {
    throw new Error(`Invalid Cloudinary URL format: ${assetUrl}`);
  }

  const resourceType = explicitResourceType || match[1] || 'raw';
  const deliveryType = explicitDeliveryType || match[2] || 'authenticated';

  if (!['raw', 'image', 'video'].includes(resourceType)) {
    throw new Error(`Invalid resource type: ${resourceType}`);
  }
  if (!['authenticated', 'upload', 'private'].includes(deliveryType)) {
    throw new Error(`Invalid delivery tier: ${deliveryType}`);
  }

  let publicId = decodeURIComponent(match[3]);
  if (!publicId || publicId.trim() === '' || publicId.includes('..') || /[\x00-\x1f]/.test(publicId)) {
    throw new Error(`Invalid public ID for signed URL generation: ${publicId}`);
  }

  const ext = publicId.split('.').pop() || 'pdf';

  // For image resources, publicId in Cloudinary does not include extension
  if (resourceType === 'image' && publicId.toLowerCase().endsWith('.' + ext.toLowerCase())) {
    publicId = publicId.slice(0, -(ext.length + 1));
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

  // Configure Cloudinary client if credentials present in environment
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinaryClient.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  const signedUrl = cloudinaryClient.utils.private_download_url(publicId, ext, {
    resource_type: resourceType,
    type: deliveryType,
    expires_at: expiresAt,
    secure: true,
  });

  return {
    signedUrl,
    expiresAt,
    publicId,
    resourceType,
    deliveryType,
  };
}
