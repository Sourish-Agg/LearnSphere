const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const submissionSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
  assignment_id: {
    type: String,
    required: true,
    index: true
  },
  student_id: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  file_path: {
    type: String,
    default: null
  },
  submitted_at: {
    type: Date,
    default: Date.now
  },
  score: {
    type: Number,
    default: null,
    min: 0
  },
  feedback: {
    type: String,
    default: null
  },
  graded_at: {
    type: Date,
    default: null
  },
  graded_by: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
submissionSchema.index({ assignment_id: 1, student_id: 1 }, { unique: true });
submissionSchema.index({ student_id: 1 });
submissionSchema.index({ graded_by: 1 });

// Methods
submissionSchema.methods.toJSON = function() {
  const submission = this.toObject();
  delete submission._id;
  return submission;
};

submissionSchema.methods.isGraded = function() {
  return this.score !== null && this.graded_at !== null;
};

submissionSchema.methods.grade = function(score, feedback, gradedBy) {
  this.score = score;
  this.feedback = feedback;
  this.graded_at = new Date();
  this.graded_by = gradedBy;
};

submissionSchema.methods.getPercentageScore = function(maxScore) {
  if (this.score === null) return null;
  return Math.round((this.score / maxScore) * 100);
};

// Static methods
submissionSchema.statics.findByAssignment = function(assignmentId) {
  return this.find({ assignment_id: assignmentId }).sort({ submitted_at: -1 });
};

submissionSchema.statics.findByStudent = function(studentId) {
  return this.find({ student_id: studentId }).sort({ submitted_at: -1 });
};

submissionSchema.statics.findByAssignmentAndStudent = function(assignmentId, studentId) {
  return this.findOne({ assignment_id: assignmentId, student_id: studentId });
};

submissionSchema.statics.findUngraded = function(assignmentId) {
  return this.find({ 
    assignment_id: assignmentId,
    score: null 
  }).sort({ submitted_at: 1 });
};

submissionSchema.statics.findGraded = function(assignmentId) {
  return this.find({ 
    assignment_id: assignmentId,
    score: { $ne: null }
  }).sort({ graded_at: -1 });
};

module.exports = mongoose.model('Submission', submissionSchema);