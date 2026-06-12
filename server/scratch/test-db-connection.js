import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }

  // Obfuscate credentials for printing
  const cleanUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`📡 Attempting connection to: ${cleanUri}`);

  mongoose.connection.on('connecting', () => console.log('⏳ Connecting to MongoDB...'));
  mongoose.connection.on('connected', () => console.log('✅ Mongoose connected successfully'));
  mongoose.connection.on('open', () => console.log('👐 Connection open'));
  mongoose.connection.on('error', (err) => console.error('❌ MongoDB error:', err));
  mongoose.connection.on('disconnected', () => console.log('🔌 Disconnected from MongoDB'));

  try {
    await mongoose.connect(uri);

    console.log('\n📊 --- CONNECTION INFO ---');
    console.log(`Connection state: ${mongoose.STATES[mongoose.connection.readyState]}`);

    // Retrieve replica set status using db.admin().command({ hello: 1 })
    const adminDb = mongoose.connection.db.admin();
    const helloInfo = await adminDb.command({ hello: 1 });
    
    console.log('\n🌟 --- REPLICA SET INFO ---');
    console.log(`Is Master (Primary): ${helloInfo.isWritablePrimary || helloInfo.ismaster}`);
    console.log(`Replica Set Name: ${helloInfo.setName}`);
    console.log(`Primary Host: ${helloInfo.primary}`);
    console.log(`All Hosts:\n  - ${helloInfo.hosts ? helloInfo.hosts.join('\n  - ') : 'None'}`);
    console.log(`Me (connected host): ${helloInfo.me}`);

    console.log('\n🔍 --- TEST QUERY ---');
    // Execute a simple query: list collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    collections.forEach(c => console.log(`  - ${c.name}`));

    // Fetch one document from User collection if it exists
    const UserSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', UserSchema, 'users');
    const oneUser = await User.findOne();
    if (oneUser) {
      console.log('\n✅ Query success: Found user in database:');
      console.log(`  - ID: ${oneUser._id}`);
      console.log(`  - Name: ${oneUser.name}`);
      console.log(`  - Role: ${oneUser.role}`);
    } else {
      console.log('\n⚠️ Query success, but "users" collection is empty.');
    }

  } catch (error) {
    console.error('❌ Connection or query failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected.');
  }
}

run();
