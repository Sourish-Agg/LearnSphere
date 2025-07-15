const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const enrollmentSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
  student_id: {
    type: String,
    required: true,
    index: true
  },
  course_id: {
    type: String,
    required: true,
    index: true
  },
  enrolled_at: {
    type: Date,
    default: Date.now
  },
  progress: {
    type: Number,
    default: 0.0,
    min: 0,
    max: 100
  },
  completed: {
    type: Boolean,
    default: false
  },
  completed_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
enrollmentSchema.index({ student_id: 1, course_id: 1 }, { unique: true });
enrollmentSchema.index({ course_id: 1 });
enrollmentSchema.index({ student_id: 1 });

// Methods
enrollmentSchema.methods.toJSON = function() {
  const enrollment = this.toObject();
  delete enrollment._id;
  return enrollment;
};

enrollmentSchema.methods.updateProgress = function(progress) {
  this.progress = Math.min(100, Math.max(0, progress));
  if (this.progress === 100 && !this.completed) {
    this.completed = true;
    this.completed_at = new Date();
  }
};

enrollmentSchema.methods.markCompleted = function() {
  this.completed = true;
  this.completed_at = new Date();
  this.progress = 100;
};

enrollmentSchema.methods.isCompleted = function() {
  return this.completed;
};

enrollmentSchema.methods.getDaysEnrolled = function() {
  const now = new Date();
  const timeDiff = now - this.enrolled_at;
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
};

// Static methods
enrollmentSchema.statics.findByStudent = function(studentId) {
  return this.find({ student_id: studentId }).sort({ enrolled_at: -1 });
};

enrollmentSchema.statics.findByCourse = function(courseId) {
  return this.find({ course_id: courseId }).sort({ enrolled_at: -1 });
};

enrollmentSchema.statics.findByStudentAndCourse = function(studentId, courseId) {
  return this.findOne({ student_id: studentId, course_id: courseId });
};

enrollmentSchema.statics.findCompleted = function(studentId) {
  return this.find({ student_id: studentId, completed: true }).sort({ completed_at: -1 });
};

enrollmentSchema.statics.findInProgress = function(studentId) {
  return this.find({ student_id: studentId, completed: false }).sort({ enrolled_at: -1 });
};

enrollmentSchema.statics.getCourseEnrollmentCount = function(courseId) {
  return this.countDocuments({ course_id: courseId });
};

enrollmentSchema.statics.getStudentEnrollmentCount = function(studentId) {
  return this.countDocuments({ student_id: studentId });
};

module.exports = mongoose.model('Enrollment', enrollmentSchema);