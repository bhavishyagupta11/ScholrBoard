/**
 * testDatabaseGuard.js — Enforces dedicated isolated test database for integration testing.
 *
 * Implements strict security controls:
 *   1. Requires non-empty MONGODB_URI_TEST.
 *   2. Prohibits silent fallback to MONGODB_URI.
 *   3. Enforces that the target database name explicitly identifies a test database.
 *   4. Strictly redacts credentials in all logs, diagnostics, and error messages.
 */
import dns from 'node:dns';

// Ensure rock-solid connection over TLS to Atlas by preferring IPv4 over unstable dynamic IPv6
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // fallback for older node environments
}

/**
 * Sanitizes MongoDB connection URIs by completely redacting authentication credentials.
 */
export function sanitizeMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return '<empty>';
  try {
    return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  } catch {
    return '<sanitized-uri>';
  }
}

/**
 * Validates that the provided URI is valid, non-empty, and targets a dedicated test database.
 * Never leaks credentials in thrown error messages.
 *
 * @param {string} uri - The candidate MONGODB_URI_TEST connection string
 * @returns {string} The extracted test database name
 * @throws {Error} If uri is missing, empty, invalid, or targets a non-test database
 */
export function validateIntegrationTestDatabaseUri(uri) {
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new Error(
      'FATAL: MONGODB_URI_TEST environment variable is missing or empty. ' +
      'Integration tests must run against a dedicated isolated test database and will never silently fall back to MONGODB_URI.'
    );
  }

  const trimmed = uri.trim();
  const sanitized = sanitizeMongoUri(trimmed);

  try {
    // Normalise protocol for URL parser
    const urlFormat = trimmed
      .replace(/^mongodb\+srv:\/\//i, 'http://')
      .replace(/^mongodb:\/\//i, 'http://');

    const parsed = new URL(urlFormat);
    const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];

    if (!dbName || !dbName.toLowerCase().includes('test')) {
      throw new Error(
        `FATAL: MONGODB_URI_TEST target database "${dbName || 'unspecified'}" is invalid. ` +
        `The database name must explicitly contain "test" (e.g. scholrboard_test) to protect development and production databases. ` +
        `Target: ${sanitized}`
      );
    }

    return dbName;
  } catch (err) {
    if (err.message.startsWith('FATAL:')) throw err;
    throw new Error(
      `FATAL: MONGODB_URI_TEST is not a valid MongoDB URI. Target: ${sanitized}`
    );
  }
}
