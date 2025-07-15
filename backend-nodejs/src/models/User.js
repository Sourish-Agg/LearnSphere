const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { USER_ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  hashed_password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.STUDENT
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Index for efficient queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

// Methods
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.hashed_password;
  delete user._id;
  return user;
};

userSchema.methods.getSafeUser = function() {
  const { hashed_password, ...user } = this.toObject();
  delete user._id;
  return user;
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByRole = function(role) {
  return this.find({ role });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ is_active: true });
};

module.exports = mongoose.model('User', userSchema);