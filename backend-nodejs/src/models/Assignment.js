const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const assignmentSchema = new mongoose.Schema({
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
  due_date: {
    type: Date,
    required: true
  },
  max_score: {
    type: Number,
    default: 100,
    min: 1,
    max: 1000
  },
  instructions: {
    type: String,
    required: true
  },
  created_by: {
    type: String,
    required: true,
    index: true
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
assignmentSchema.index({ course_id: 1, created_by: 1 });
assignmentSchema.index({ due_date: 1 });

// Methods
assignmentSchema.methods.toJSON = function() {
  const assignment = this.toObject();
  delete assignment._id;
  return assignment;
};

assignmentSchema.methods.isOverdue = function() {
  return new Date() > this.due_date;
};

assignmentSchema.methods.getDaysUntilDue = function() {
  const now = new Date();
  const timeDiff = this.due_date - now;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

// Static methods
assignmentSchema.statics.findByCourse = function(courseId) {
  return this.find({ course_id: courseId }).sort({ created_at: -1 });
};

assignmentSchema.statics.findByCourseAndInstructor = function(courseId, instructorId) {
  return this.find({ course_id: courseId, created_by: instructorId });
};

assignmentSchema.statics.findUpcoming = function(courseId, days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({ 
    course_id: courseId,
    due_date: { $gte: new Date(), $lte: futureDate }
  }).sort({ due_date: 1 });
};

assignmentSchema.statics.findOverdue = function(courseId) {
  return this.find({ 
    course_id: courseId,
    due_date: { $lt: new Date() }
  }).sort({ due_date: -1 });
};

module.exports = mongoose.model('Assignment', assignmentSchema);