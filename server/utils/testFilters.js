/**
 * Centralized utility to filter out test accounts (E2E, smoke, manual, scholrboard.test)
 */

export const TEST_EMAIL_REGEX = /e2e|smoke|manual|scholrboard\.test/i;

/**
 * Returns the standard Mongoose match query to exclude test emails.
 * Usage: User.find({ ...excludeTestUsers() })
 */
export const excludeTestUsers = () => {
  return {
    email: { $not: TEST_EMAIL_REGEX }
  };
};
