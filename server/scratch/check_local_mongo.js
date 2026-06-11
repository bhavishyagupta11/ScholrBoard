import mongoose from 'mongoose';
async function test() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/scholrboard_test');
    console.log("✅ Local MongoDB connected successfully!");
    await mongoose.connection.close();
    process.exit(0);
  } catch (e) {
    console.error("❌ Local MongoDB failed:", e.message);
    process.exit(1);
  }
}
test();
