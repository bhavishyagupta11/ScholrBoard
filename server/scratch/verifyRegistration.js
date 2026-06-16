import '../config/env.js';
import mongoose from 'mongoose';
import { resolveTrackForDepartment } from '../utils/trackResolver.js';
import Track from '../models/Track.js';

async function verifyRegistration() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('📡 Connected to MongoDB');

  const cseTrackId = await resolveTrackForDepartment('CSE');
  const mechTrackId = await resolveTrackForDepartment('Mechanical');

  const cseTrack = await Track.findById(cseTrackId);
  const mechTrack = await Track.findById(mechTrackId);

  console.log('\n--- REGISTRATION SIMULATION ---');
  console.log(`CSE Student Registration -> Assigned TrackId: ${cseTrackId} (${cseTrack.name})`);
  console.log(`Mechanical Student Registration -> Assigned TrackId: ${mechTrackId} (${mechTrack.name})`);

  process.exit(0);
}

verifyRegistration();
