const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const progressSchema = new mongoose.Schema({
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
  module_id: {
    type: String,
    default: null,
    index: true
  },
  assignment_id: {
    type: String,
    default: null,
    index: true
  },
  quiz_id: {
    type: String,
    default: null,
    index: true
  },
  item_type: {
    type: String,
    enum: ['module', 'assignment', 'quiz', 'video', 'pdf', 'reading'],
    required: true
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'overdue'],
    default: 'not_started'
  },
  progress_percentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  time_spent_minutes: {
    type: Number,
    default: 0,
    min: 0
  },
  completed_at: {
    type: Date,
    default: null
  },
  started_at: {
    type: Date,
    default: null
  },
  last_accessed: {
    type: Date,
    default: Date.now
  },
  due_date: {
    type: Date,
    default: null
  },
  score: {
    type: Number,
    default: null,
    min: 0
  },
  max_score: {
    type: Number,
    default: null,
    min: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for efficient queries
progressSchema.index({ student_id: 1, course_id: 1 });
progressSchema.index({ course_id: 1, status: 1 });
progressSchema.index({ student_id: 1, status: 1 });
progressSchema.index({ due_date: 1, status: 1 });

// Methods
progressSchema.methods.toJSON = function() {
  const progress = this.toObject();
  delete progress._id;
  return progress;
};

progressSchema.methods.markAsStarted = function() {
  if (this.status === 'not_started') {
    this.status = 'in_progress';
    this.started_at = new Date();
  }
  this.last_accessed = new Date();
};

progressSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.progress_percentage = 100;
  this.completed_at = new Date();
  this.last_accessed = new Date();
};

progressSchema.methods.updateProgress = function(percentage, timeSpent = 0) {
  this.progress_percentage = Math.min(100, Math.max(0, percentage));
  this.time_spent_minutes += timeSpent;
  this.last_accessed = new Date();
  
  if (this.status === 'not_started' && percentage > 0) {
    this.status = 'in_progress';
    this.started_at = new Date();
  }
  
  if (percentage >= 100) {
    this.markAsCompleted();
  }
};

progressSchema.methods.checkOverdue = function() {
  if (this.due_date && new Date() > this.due_date && this.status !== 'completed') {
    this.status = 'overdue';
  }
};

progressSchema.methods.isOverdue = function() {
  return this.due_date && new Date() > this.due_date && this.status !== 'completed';
};

progressSchema.methods.getDaysUntilDue = function() {
  if (!this.due_date) return null;
  
  const now = new Date();
  const timeDiff = this.due_date - now;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

progressSchema.methods.getProgressSummary = function() {
  return {
    id: this.id,
    item_type: this.item_type,
    status: this.status,
    progress_percentage: this.progress_percentage,
    time_spent_minutes: this.time_spent_minutes,
    is_overdue: this.isOverdue(),
    days_until_due: this.getDaysUntilDue(),
    score: this.score,
    max_score: this.max_score,
    grade_percentage: this.max_score ? Math.round((this.score / this.max_score) * 100) : null
  };
};

// Static methods
progressSchema.statics.findByStudent = function(studentId, courseId = null) {
  const query = { student_id: studentId };
  if (courseId) query.course_id = courseId;
  return this.find(query).sort({ created_at: -1 });
};

progressSchema.statics.findByCourse = function(courseId, status = null) {
  const query = { course_id: courseId };
  if (status) query.status = status;
  return this.find(query).sort({ created_at: -1 });
};

progressSchema.statics.findByStudentAndCourse = function(studentId, courseId) {
  return this.find({ student_id: studentId, course_id: courseId }).sort({ created_at: -1 });
};

progressSchema.statics.getStudentCourseProgress = async function(studentId, courseId) {
  const allProgress = await this.find({ student_id: studentId, course_id: courseId });
  
  const summary = {
    total_items: allProgress.length,
    completed_items: 0,
    in_progress_items: 0,
    not_started_items: 0,
    overdue_items: 0,
    overall_progress: 0,
    total_time_spent: 0,
    total_score: 0,
    total_max_score: 0,
    average_score: 0,
    by_type: {}
  };

  if (allProgress.length === 0) {
    return summary;
  }

  allProgress.forEach(progress => {
    // Count by status
    switch (progress.status) {
      case 'completed':
        summary.completed_items++;
        break;
      case 'in_progress':
        summary.in_progress_items++;
        break;
      case 'not_started':
        summary.not_started_items++;
        break;
      case 'overdue':
        summary.overdue_items++;
        break;
    }

    // Accumulate time and scores
    summary.total_time_spent += progress.time_spent_minutes || 0;
    if (progress.score !== null) {
      summary.total_score += progress.score;
    }
    if (progress.max_score !== null) {
      summary.total_max_score += progress.max_score;
    }

    // Group by type
    if (!summary.by_type[progress.item_type]) {
      summary.by_type[progress.item_type] = {
        total: 0,
        completed: 0,
        in_progress: 0,
        not_started: 0,
        overdue: 0
      };
    }
    
    summary.by_type[progress.item_type].total++;
    summary.by_type[progress.item_type][progress.status]++;
  });

  // Calculate overall progress
  summary.overall_progress = Math.round((summary.completed_items / summary.total_items) * 100);
  
  // Calculate average score
  if (summary.total_max_score > 0) {
    summary.average_score = Math.round((summary.total_score / summary.total_max_score) * 100);
  }

  return summary;
};

progressSchema.statics.getOverdueItems = function(studentId = null, courseId = null) {
  const query = {
    due_date: { $lt: new Date() },
    status: { $ne: 'completed' }
  };
  
  if (studentId) query.student_id = studentId;
  if (courseId) query.course_id = courseId;
  
  return this.find(query).sort({ due_date: 1 });
};

progressSchema.statics.getUpcomingDeadlines = function(studentId, days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    student_id: studentId,
    due_date: { $gte: new Date(), $lte: futureDate },
    status: { $ne: 'completed' }
  }).sort({ due_date: 1 });
};

progressSchema.statics.initializeStudentProgress = async function(studentId, courseId) {
  const Course = require('./Course');
  const Module = require('./Module');
  const Assignment = require('./Assignment');
  const Quiz = require('./Quiz');

  const course = await Course.findOne({ id: courseId });
  if (!course) return false;

  const progressItems = [];

  // Initialize progress for modules
  const modules = await Module.findByCourse(courseId);
  modules.forEach(module => {
    progressItems.push({
      student_id: studentId,
      course_id: courseId,
      module_id: module.id,
      item_type: 'module',
      status: 'not_started'
    });
  });

  // Initialize progress for assignments
  const assignments = await Assignment.findByCourse(courseId);
  assignments.forEach(assignment => {
    progressItems.push({
      student_id: studentId,
      course_id: courseId,
      assignment_id: assignment.id,
      item_type: 'assignment',
      status: 'not_started',
      due_date: assignment.due_date,
      max_score: assignment.max_score
    });
  });

  // Initialize progress for quizzes
  const quizzes = await Quiz.findByCourse(courseId);
  quizzes.forEach(quiz => {
    progressItems.push({
      student_id: studentId,
      course_id: courseId,
      quiz_id: quiz.id,
      item_type: 'quiz',
      status: 'not_started',
      max_score: quiz.getTotalPoints()
    });
  });

  // Bulk insert progress items
  if (progressItems.length > 0) {
    await this.insertMany(progressItems);
  }

  return true;
};

module.exports = mongoose.model('Progress', progressSchema);