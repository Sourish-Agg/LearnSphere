const express = require('express');
const Discussion = require('../models/Discussion');
const Reply = require('../models/Reply');
const Course = require('../models/Course');
const User = require('../models/User');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

// Create new discussion
router.post('/:course_id/discussions',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateDiscussionCreation(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;
    const discussionData = req.validatedData;

    // Check course access
    const course = await Course.findOne({ id: course_id });
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    discussionData.course_id = course_id;
    discussionData.created_by = req.user.id;
    
    const discussion = new Discussion(discussionData);
    await discussion.save();

    logger.info(`Discussion created: ${discussion.title} in course: ${course.title}`);

    res.status(201).json(discussion.toJSON());
  })
);

// Get all discussions for a course
router.get('/:course_id/discussions',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateCourseId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;

    // Check course access
    const course = await Course.findOne({ id: course_id });
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    const discussions = await Discussion.findByCourse(course_id);
    
    // Add creator info
    const discussionsWithCreator = await Promise.all(
      discussions.map(async (discussion) => {
        const creator = await User.findOne({ id: discussion.created_by });
        const discussionObj = discussion.toJSON();
        discussionObj.creator_name = creator ? creator.full_name : 'Unknown';
        return discussionObj;
      })
    );

    res.json(discussionsWithCreator);
  })
);

// Get specific discussion
router.get('/:course_id/discussions/:discussion_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateDiscussionId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id, discussion_id } = req.params;

    // Check course access
    const course = await Course.findOne({ id: course_id });
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    const discussion = await Discussion.findOne({ id: discussion_id, course_id });
    if (!discussion) {
      return res.status(404).json({ 
        detail: 'Discussion not found' 
      });
    }

    // Add creator info
    const creator = await User.findOne({ id: discussion.created_by });
    const discussionObj = discussion.toJSON();
    discussionObj.creator_name = creator ? creator.full_name : 'Unknown';

    res.json(discussionObj);
  })
);

// Create reply to discussion
router.post('/discussions/:discussion_id/replies',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateDiscussionId(),
  ValidationMiddleware.validateReplyCreation(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { discussion_id } = req.params;
    const replyData = req.validatedData;

    const discussion = await Discussion.findOne({ id: discussion_id });
    if (!discussion) {
      return res.status(404).json({ 
        detail: 'Discussion not found' 
      });
    }

    // Check course access
    const course = await Course.findOne({ id: discussion.course_id });
    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    replyData.discussion_id = discussion_id;
    replyData.created_by = req.user.id;
    
    const reply = new Reply(replyData);
    await reply.save();

    // Add reply to discussion
    const replyObj = reply.addReply(replyData.content, req.user.id);
    discussion.replies.push(replyObj);
    await discussion.save();

    logger.info(`Reply created in discussion: ${discussion.title} by ${req.user.email}`);

    res.status(201).json(reply.toJSON());
  })
);

// Get all replies for a discussion
router.get('/discussions/:discussion_id/replies',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateDiscussionId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { discussion_id } = req.params;

    const discussion = await Discussion.findOne({ id: discussion_id });
    if (!discussion) {
      return res.status(404).json({ 
        detail: 'Discussion not found' 
      });
    }

    // Check course access
    const course = await Course.findOne({ id: discussion.course_id });
    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    const replies = await Reply.findByDiscussion(discussion_id);
    
    // Add creator info
    const repliesWithCreator = await Promise.all(
      replies.map(async (reply) => {
        const creator = await User.findOne({ id: reply.created_by });
        const replyObj = reply.toJSON();
        replyObj.creator_name = creator ? creator.full_name : 'Unknown';
        return replyObj;
      })
    );

    res.json(repliesWithCreator);
  })
);

// Delete discussion (only by creator or instructor)
router.delete('/:course_id/discussions/:discussion_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateDiscussionId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id, discussion_id } = req.params;

    const discussion = await Discussion.findOne({ id: discussion_id, course_id });
    if (!discussion) {
      return res.status(404).json({ 
        detail: 'Discussion not found' 
      });
    }

    const course = await Course.findOne({ id: course_id });
    
    // Check if user can delete (creator, instructor of the course, or admin)
    const canDelete = discussion.created_by === req.user.id ||
                     (req.user.role === USER_ROLES.INSTRUCTOR && course.instructor_id === req.user.id) ||
                     req.user.role === USER_ROLES.ADMIN;

    if (!canDelete) {
      return res.status(403).json({ 
        detail: 'Not authorized to delete this discussion' 
      });
    }

    await Discussion.deleteOne({ id: discussion_id });
    await Reply.deleteMany({ discussion_id });

    logger.info(`Discussion deleted: ${discussion.title} by ${req.user.email}`);

    res.json({ 
      message: 'Discussion deleted successfully' 
    });
  })
);

// Delete reply (only by creator or instructor)
router.delete('/discussions/:discussion_id/replies/:reply_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateDiscussionId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { discussion_id, reply_id } = req.params;

    const discussion = await Discussion.findOne({ id: discussion_id });
    if (!discussion) {
      return res.status(404).json({ 
        detail: 'Discussion not found' 
      });
    }

    const reply = await Reply.findOne({ id: reply_id, discussion_id });
    if (!reply) {
      return res.status(404).json({ 
        detail: 'Reply not found' 
      });
    }

    const course = await Course.findOne({ id: discussion.course_id });
    
    // Check if user can delete (creator, instructor of the course, or admin)
    const canDelete = reply.created_by === req.user.id ||
                     (req.user.role === USER_ROLES.INSTRUCTOR && course.instructor_id === req.user.id) ||
                     req.user.role === USER_ROLES.ADMIN;

    if (!canDelete) {
      return res.status(403).json({ 
        detail: 'Not authorized to delete this reply' 
      });
    }

    await Reply.deleteOne({ id: reply_id });
    
    // Remove reply from discussion
    discussion.replies = discussion.replies.filter(r => r.id !== reply_id);
    await discussion.save();

    logger.info(`Reply deleted from discussion: ${discussion.title} by ${req.user.email}`);

    res.json({ 
      message: 'Reply deleted successfully' 
    });
  })
);

// Helper function to check course access
async function checkCourseAccess(course, user) {
  // Admin can access all courses
  if (user.role === USER_ROLES.ADMIN) {
    return true;
  }

  // Instructor can access their own courses
  if (user.role === USER_ROLES.INSTRUCTOR && course.instructor_id === user.id) {
    return true;
  }

  // Students can access if enrolled OR if course is published
  if (user.role === USER_ROLES.STUDENT) {
    const Enrollment = require('../models/Enrollment');
    const enrollment = await Enrollment.findByStudentAndCourse(user.id, course.id);
    
    if (enrollment) {
      return true;
    }

    // Allow access to published courses for browsing
    if (course.is_published) {
      return true;
    }
  }

  return false;
}

module.exports = router;