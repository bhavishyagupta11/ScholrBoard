import mongoose from 'mongoose';

/**
 * Execute a callback inside a MongoDB transaction.
 * Rolls back automatically on error. Requires a replica set (Atlas / local rs).
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export default withTransaction;
