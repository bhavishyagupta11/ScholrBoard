import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  role: {
    type: String,
    enum: ['student', 'faculty', 'admin'],
    required: [true, 'Role is required']
  },
  verified: {
    type: Boolean,
    default: false
  },
  studentId: {
    type: String,
    sparse: true,
    unique: true,
    required: function() { return this.role === 'student'; }
  },
  facultyId: {
    type: String,
    sparse: true,
    unique: true,
    required: function() { return this.role === 'faculty'; }
  },
  department: {
    type: String,
    required: function() { return this.role === 'faculty' || this.role === 'student'; }
  },
  semester: {
    type: Number,
    min: 1,
    max: 8,
    required: function() { return this.role === 'student'; }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password validity
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;