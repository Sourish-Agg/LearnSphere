const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const replySchema = new mongoose.Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
  discussion_id: {
    type: String,
    required: true,
    index: true
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
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
replySchema.index({ discussion_id: 1, created_at: 1 });
replySchema.index({ created_by: 1 });

// Methods
replySchema.methods.toJSON = function() {
  const reply = this.toObject();
  delete reply._id;
  return reply;
};

// Static methods
replySchema.statics.findByDiscussion = function(discussionId) {
  return this.find({ discussion_id: discussionId }).sort({ created_at: 1 });
};

replySchema.statics.findByUser = function(userId) {
  return this.find({ created_by: userId }).sort({ created_at: -1 });
};

replySchema.statics.findByDiscussionAndUser = function(discussionId, userId) {
  return this.find({ discussion_id: discussionId, created_by: userId }).sort({ created_at: -1 });
};

module.exports = mongoose.model('Reply', replySchema);