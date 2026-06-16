import './config/env.js';
import mongoose from 'mongoose';
import Track from './models/Track.js';
import User from './models/User.js';

async function checkTracks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const tracks = await Track.find({});
    console.log('TRACKS FOUND:', tracks.length);
    tracks.forEach(t => console.log(`- ${t.code} (${t.name})`));

    const totalStudents = await User.countDocuments({ role: 'student' });
    const studentsWithTrack = await User.countDocuments({ role: 'student', trackId: { $ne: null } });
    console.log(`\nSTUDENTS: ${totalStudents}`);
    console.log(`STUDENTS WITH TRACK: ${studentsWithTrack}`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTracks();
