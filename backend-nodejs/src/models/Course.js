const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const courseSchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
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
  instructor_id: {
    type: String,
    required: true,
    index: true
  },
  duration_weeks: {
    type: Number,
    default: 8,
    min: 1,
    max: 52
  },
  max_students: {
    type: Number,
    default: 50,
    min: 1,
    max: 1000
  },
  is_published: {
    type: Boolean,
    default: false
  },
  enrolled_students: [{
    type: String
  }],
  modules: [{
    type: mongoose.Schema.Types.Mixed
  }],
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
courseSchema.index({ instructor_id: 1 });
courseSchema.index({ is_published: 1 });
courseSchema.index({ title: 'text', description: 'text' });

// Methods
courseSchema.methods.toJSON = function() {
  const course = this.toObject();
  delete course._id;
  return course;
};

courseSchema.methods.isInstructor = function(userId) {
  return this.instructor_id === userId;
};

courseSchema.methods.isStudentEnrolled = function(studentId) {
  return this.enrolled_students.includes(studentId);
};

courseSchema.methods.enrollStudent = function(studentId) {
  if (!this.isStudentEnrolled(studentId)) {
    this.enrolled_students.push(studentId);
  }
};

courseSchema.methods.unenrollStudent = function(studentId) {
  this.enrolled_students = this.enrolled_students.filter(id => id !== studentId);
};

// Static methods
courseSchema.statics.findByInstructor = function(instructorId) {
  return this.find({ instructor_id: instructorId });
};

courseSchema.statics.findPublished = function() {
  return this.find({ is_published: true });
};

courseSchema.statics.findByIdAndInstructor = function(courseId, instructorId) {
  return this.findOne({ id: courseId, instructor_id: instructorId });
};

module.exports = mongoose.model('Course', courseSchema);