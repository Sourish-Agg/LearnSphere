const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const quizSchema = new mongoose.Schema({
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
  duration_minutes: {
    type: Number,
    default: 30,
    min: 1,
    max: 180
  },
  max_attempts: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  questions: [{
    question: {
      type: String,
      required: true
    },
    options: [{
      type: String,
      required: true
    }],
    correct_answer: {
      type: Number,
      required: true,
      min: 0,
      max: 3
    },
    points: {
      type: Number,
      default: 1,
      min: 1
    }
  }],
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
quizSchema.index({ course_id: 1, created_by: 1 });

// Methods
quizSchema.methods.toJSON = function() {
  const quiz = this.toObject();
  delete quiz._id;
  return quiz;
};

quizSchema.methods.getTotalPoints = function() {
  return this.questions.reduce((total, question) => total + question.points, 0);
};

quizSchema.methods.getQuestionsCount = function() {
  return this.questions.length;
};

quizSchema.methods.getQuestionsForStudent = function() {
  // Return questions without correct answers for students
  return this.questions.map(q => ({
    question: q.question,
    options: q.options
  }));
};

// Static methods
quizSchema.statics.findByCourse = function(courseId) {
  return this.find({ course_id: courseId }).sort({ created_at: -1 });
};

quizSchema.statics.findByCourseAndInstructor = function(courseId, instructorId) {
  return this.find({ course_id: courseId, created_by: instructorId });
};

module.exports = mongoose.model('Quiz', quizSchema);