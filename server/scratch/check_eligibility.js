import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Opportunity from '../models/Opportunity.js';
import { evaluatePlacementEligibility } from '../services/eligibilityService.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('DB Connected.');

  // Find the student
  const student = await User.findOne({ email: 'techzpath@gmail.com' });
  if (!student) {
    console.log('No student found with email techzpath@gmail.com.');
    await mongoose.disconnect();
    return;
  }
  console.log('\n--- STUDENT USER DOCUMENT ---');
  console.log(JSON.stringify(student, null, 2));

  // Find the profile
  const profile = await Profile.findOne({ userId: student._id });
  console.log('\n--- STUDENT PROFILE DOCUMENT ---');
  if (profile) {
    console.log(JSON.stringify(profile, null, 2));
  } else {
    console.log('Profile is NULL');
  }

  // Find opportunities
  const opportunities = await Opportunity.find({});
  console.log(`\nFound ${opportunities.length} opportunities.`);

  for (const op of opportunities) {
    console.log(`\n--- OPPORTUNITY: ${op.company} - ${op.title} (Code: ${op.driveCode}) ---`);
    console.log('Eligibility Criteria:', JSON.stringify(op.eligibility, null, 2));
    
    if (profile) {
      const evaluation = evaluatePlacementEligibility(student, profile, op);
      console.log('Evaluation result:', evaluation);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
