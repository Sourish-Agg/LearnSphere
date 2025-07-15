const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const discussionSchema = new mongoose.Schema({
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
  content: {
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
  },
  replies: [{
    id: {
      type: String,
      default: uuidv4
    },
    content: {
      type: String,
      required: true
    },
    created_by: {
      type: String,
      required: true
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
discussionSchema.index({ course_id: 1, created_at: -1 });
discussionSchema.index({ created_by: 1 });

// Methods
discussionSchema.methods.toJSON = function() {
  const discussion = this.toObject();
  delete discussion._id;
  return discussion;
};

discussionSchema.methods.addReply = function(content, userId) {
  const reply = {
    id: uuidv4(),
    content: content,
    created_by: userId,
    created_at: new Date()
  };
  this.replies.push(reply);
  return reply;
};

discussionSchema.methods.getRepliesCount = function() {
  return this.replies.length;
};

discussionSchema.methods.getLatestReply = function() {
  if (this.replies.length === 0) return null;
  return this.replies[this.replies.length - 1];
};

// Static methods
discussionSchema.statics.findByCourse = function(courseId) {
  return this.find({ course_id: courseId }).sort({ created_at: -1 });
};

discussionSchema.statics.findByUser = function(userId) {
  return this.find({ created_by: userId }).sort({ created_at: -1 });
};

discussionSchema.statics.findByCourseAndUser = function(courseId, userId) {
  return this.find({ course_id: courseId, created_by: userId }).sort({ created_at: -1 });
};

module.exports = mongoose.model('Discussion', discussionSchema);