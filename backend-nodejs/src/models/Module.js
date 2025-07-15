const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { CONTENT_TYPES } = require('../config/constants');

const moduleSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
  course_id: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true,
    min: 1
  },
  content_type: {
    type: String,
    enum: Object.values(CONTENT_TYPES),
    default: CONTENT_TYPES.TEXT
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
moduleSchema.index({ course_id: 1, order: 1 });
moduleSchema.index({ course_id: 1, id: 1 });

// Methods
moduleSchema.methods.toJSON = function() {
  const module = this.toObject();
  delete module._id;
  return module;
};

// Static methods
moduleSchema.statics.findByCourse = function(courseId) {
  return this.find({ course_id: courseId }).sort({ order: 1 });
};

moduleSchema.statics.findByCourseAndId = function(courseId, moduleId) {
  return this.findOne({ course_id: courseId, id: moduleId });
};

moduleSchema.statics.getNextOrder = async function(courseId) {
  const lastModule = await this.findOne({ course_id: courseId })
    .sort({ order: -1 })
    .limit(1);
  
  return lastModule ? lastModule.order + 1 : 1;
};

module.exports = mongoose.model('Module', moduleSchema);