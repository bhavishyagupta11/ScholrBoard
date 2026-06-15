import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on('connected', () => console.log('Database is connected'));
    mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err));

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected Successfully');

    const models = [
      '../models/User.js',
      '../models/Activity.js',
      '../models/Notification.js',
      '../models/Opportunity.js',
      '../models/Scholarship.js',
      '../models/Application.js',
      '../models/ScholarshipApplication.js',
      '../models/OdRequest.js',
      '../models/AuditLog.js',
    ];
    for (const modelPath of models) {
      const { default: Model } = await import(modelPath);
      await Model.syncIndexes();
    }
    console.log('Database indexes synchronized');
  } catch (error) {
    console.error('Could not connect to MongoDB:', error);
    process.exit(1);
  }
}

export default connectDB
