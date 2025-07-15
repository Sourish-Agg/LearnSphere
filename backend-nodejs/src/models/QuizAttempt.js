const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const quizAttemptSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
  quiz_id: {
    type: String,
    required: true,
    index: true
  },
  student_id: {
    type: String,
    required: true,
    index: true
  },
  answers: [{
    answer: {
      type: Number,
      required: true,
      min: 0,
      max: 3
    }
  }],
  score: {
    type: Number,
    required: true,
    min: 0
  },
  max_score: {
    type: Number,
    required: true,
    min: 0
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  completed_at: {
    type: Date,
    default: null
  },
  attempt_number: {
    type: Number,
    required: true,
    min: 1
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
quizAttemptSchema.index({ quiz_id: 1, student_id: 1 });
quizAttemptSchema.index({ student_id: 1 });

// Methods
quizAttemptSchema.methods.toJSON = function() {
  const attempt = this.toObject();
  delete attempt._id;
  return attempt;
};

quizAttemptSchema.methods.getPercentageScore = function() {
  if (this.max_score === 0) return 0;
  return Math.round((this.score / this.max_score) * 100);
};

quizAttemptSchema.methods.isCompleted = function() {
  return this.completed_at !== null;
};

quizAttemptSchema.methods.complete = function() {
  this.completed_at = new Date();
};

quizAttemptSchema.methods.getDurationInMinutes = function() {
  if (!this.completed_at) return null;
  const durationMs = this.completed_at - this.started_at;
  return Math.round(durationMs / (1000 * 60));
};

// Static methods
quizAttemptSchema.statics.findByQuiz = function(quizId) {
  return this.find({ quiz_id: quizId }).sort({ started_at: -1 });
};

quizAttemptSchema.statics.findByStudent = function(studentId) {
  return this.find({ student_id: studentId }).sort({ started_at: -1 });
};

quizAttemptSchema.statics.findByQuizAndStudent = function(quizId, studentId) {
  return this.find({ quiz_id: quizId, student_id: studentId }).sort({ attempt_number: -1 });
};

quizAttemptSchema.statics.getAttemptCount = function(quizId, studentId) {
  return this.countDocuments({ quiz_id: quizId, student_id: studentId });
};

quizAttemptSchema.statics.getBestScore = function(quizId, studentId) {
  return this.findOne({ quiz_id: quizId, student_id: studentId })
    .sort({ score: -1 })
    .limit(1);
};

quizAttemptSchema.statics.getLatestAttempt = function(quizId, studentId) {
  return this.findOne({ quiz_id: quizId, student_id: studentId })
    .sort({ started_at: -1 })
    .limit(1);
};

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);