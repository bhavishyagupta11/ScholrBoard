import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Event from '../models/Event.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('DB Connected.');

  const events = await Event.find({});
  console.log(`Found ${events.length} events.`);

  for (const event of events) {
    console.log(`Event ID: ${event._id}`);
    console.log(`Title: ${event.title}`);
    console.log(`Category: ${event.category}`);
    console.log(`Requires Registration: ${event.requiresRegistration}`);
    console.log(`Attendees Count: ${event.attendees?.length || 0}`);
    console.log(`Attendees:`, JSON.stringify(event.attendees));
    console.log('-------------------------------------------');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
