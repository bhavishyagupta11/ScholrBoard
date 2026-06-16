import '../config/env.js';
import mongoose from 'mongoose';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI_TEST || process.env.MONGODB_URI);
  await mongoose.connection.collection('tracks').drop().catch(() => {});
  console.log('Dropped');
  process.exit(0);
};
run();
