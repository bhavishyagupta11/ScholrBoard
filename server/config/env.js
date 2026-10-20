import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

// ─── METHODOLOGY NOMINAL WEIGHTS (V13 Part 6.2 & Part 7.2) ───────────────────
export const DEVELOPER_V3_NOMINAL_WEIGHTS = Object.freeze({
  dsa: 0.30,
  engActivity: 0.25,
  repoQuality: 0.20,
  cp: 0.15,
  breadth: 0.10,
});

export const PLACEMENT_V2_NOMINAL_WEIGHTS = Object.freeze({
  placementDsa: 0.28,
  resumeReadiness: 0.22,
  portfolio: 0.17,
  academic: 0.17,
  achievements: 0.11,
  completeness: 0.05,
});

// ─── STARTUP WEIGHT VALIDATION (V13 Part 6.2, Part 19.2, Part 27 Phase 1) ────
export function validateWeights(weights, label = 'Methodology') {
  if (!weights || typeof weights !== 'object') {
    throw new Error(`[FATAL] ${label} weights configuration is missing or invalid`);
  }

  for (const [k, v] of Object.entries(weights)) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error(`[FATAL] ${label}.${k} = ${v} not in [0,1]`);
    }
  }

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(`[FATAL] ${label} weights sum = ${sum.toFixed(4)}, must be 1.0`);
  }
  return true;
}

// ─── STARTUP GEMINI MODEL VALIDATION (V13 Part 16 & Part 27 Phase 1) ─────────
const DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-3.5-flash', // Deprecated per Google docs: auto-routed to gemini-3.6-flash
  'gemini-flash-lite-latest',
]);

export function validateGeminiModels() {
  const primary = (process.env.GEMINI_PRIMARY_MODEL || 'gemini-3.8-flash').trim();
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  if (DEPRECATED_GEMINI_MODELS.has(primary)) {
    throw new Error(`[FATAL] GEMINI_PRIMARY_MODEL="${primary}" is deprecated or invalid. Please configure a valid model such as gemini-3.8-flash.`);
  }

  for (const fallback of fallbacks) {
    if (DEPRECATED_GEMINI_MODELS.has(fallback)) {
      console.warn(`[WARNING] Deprecated model "${fallback}" in GEMINI_FALLBACK_MODELS. Removing from active fallback list.`);
    }
  }

  return {
    primary,
    fallbacks: fallbacks.filter((m) => !DEPRECATED_GEMINI_MODELS.has(m)),
  };
}

export async function verifyGeminiModelsLive() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[startup] GEMINI_API_KEY not configured; skipping live model list verification');
    return null;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
      console.warn(`[startup] Failed to fetch live Gemini model list: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const available = new Set((data.models || []).map((m) => m.name.replace('models/', '')));

    const primary = (process.env.GEMINI_PRIMARY_MODEL || 'gemini-3.8-flash').trim();
    const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    const primaryStatus = available.has(primary) ? 'VALID' : 'NOT_FOUND';
    console.log(`[startup] GEMINI primary: ${primary} (${primaryStatus})`);

    const fallbackStatuses = {};
    for (const fb of fallbacks) {
      const fbStatus = available.has(fb) ? 'VALID' : 'NOT_FOUND';
      fallbackStatuses[fb] = fbStatus;
      console.log(`[startup] GEMINI fallback: ${fb} (${fbStatus})`);
    }

    return {
      availableModelsCount: available.size,
      primary: { model: primary, status: primaryStatus },
      fallbacks: fallbackStatuses,
    };
  } catch (err) {
    console.warn('[startup] Live Gemini model list check failed (network/offline):', err.message);
    return null;
  }
}

// ─── STARTUP CLOUDINARY VALIDATION (V13 Part 14 & Part 27 Phase 1) ───────────
export function validateCloudinaryConfig() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, NODE_ENV } = process.env;
  const isConfigured = Boolean(
    CLOUDINARY_CLOUD_NAME &&
    CLOUDINARY_API_KEY &&
    CLOUDINARY_API_SECRET &&
    !CLOUDINARY_CLOUD_NAME.startsWith('your_') &&
    !CLOUDINARY_API_KEY.startsWith('your_') &&
    !CLOUDINARY_API_SECRET.startsWith('your_')
  );

  if (NODE_ENV === 'production' && !isConfigured) {
    throw new Error('[FATAL] Cloudinary credentials missing or placeholder in production environment.');
  }
  return isConfigured;
}

// ─── STARTUP ENVIRONMENT PRESENCE LOGGING (V13 Part 27 Phase 1) ──────────────
export function logEnvPresence() {
  const keysToInspect = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET',
    'CLIENT_ORIGIN',
    'GITHUB_TOKEN',
    'GEMINI_API_KEY',
    'GEMINI_PRIMARY_MODEL',
    'GEMINI_FALLBACK_MODELS',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'RESEND_API_KEY',
  ];

  const summary = {};
  for (const k of keysToInspect) {
    if (k === 'NODE_ENV' || k === 'PORT' || k === 'GEMINI_PRIMARY_MODEL') {
      summary[k] = process.env[k] || 'unset';
    } else {
      summary[k] = process.env[k] ? 'PRESENT' : 'UNSET';
    }
  }
  console.log('[STARTUP] Environment Presence Summary:', JSON.stringify(summary));
}

// Execute startup validations (fail-fast on fatal misconfiguration)
try {
  validateWeights(DEVELOPER_V3_NOMINAL_WEIGHTS, 'Developer Score v3');
  validateWeights(PLACEMENT_V2_NOMINAL_WEIGHTS, 'Placement Readiness v2');
  validateGeminiModels();
  if (process.env.NODE_ENV !== 'test') {
    validateCloudinaryConfig();
    logEnvPresence();
    if (process.env.GEMINI_API_KEY) {
      verifyGeminiModelsLive().catch((err) => {
        console.warn('[startup] verifyGeminiModelsLive error:', err.message);
      });
    }
  }
} catch (err) {
  console.error('\n==================================');
  console.error('Fatal Startup Configuration Error:');
  console.error(err.message);
  console.error('==================================\n');
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  } else {
    throw err;
  }
}
