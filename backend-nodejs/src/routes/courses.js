const express = require('express');
const Course = require('../models/Course');
const User = require('../models/User');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const Helpers = require('../utils/helpers');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

// Create new course
router.post('/',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateCourseCreation(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const courseData = req.validatedData;
    courseData.instructor_id = req.user.id;

    const course = new Course(courseData);
    await course.save();

    logger.info(`Course created: ${course.title} by ${req.user.email}`);

    res.status(201).json(course.toJSON());
  })
);

// Get all courses
router.get('/',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    let courses;

    if (req.user.role === USER_ROLES.INSTRUCTOR) {
      // Instructors see their own courses
      courses = await Course.findByInstructor(req.user.id);
    } else if (req.user.role === USER_ROLES.ADMIN) {
      // Admins see all courses
      courses = await Course.find().sort({ created_at: -1 });
    } else {
      // Students see published courses
      courses = await Course.findPublished();
    }

    const cleanCourses = courses.map(course => course.toJSON());
    res.json(cleanCourses);
  })
);

// Get course by ID
router.get('/:course_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateCourseId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;
    const course = await Course.findOne({ id: course_id });

    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    // Check access permissions
    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    res.json(course.toJSON());
  })
);

// Update course
router.put('/:course_id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateCourseUpdate(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;
    const updateData = req.validatedData;

    const course = await Course.findByIdAndInstructor(course_id, req.user.id);
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    // Update course fields
    Object.keys(updateData).forEach(key => {
      course[key] = updateData[key];
    });

    await course.save();

    logger.info(`Course updated: ${course.title} by ${req.user.email}`);

    res.json(course.toJSON());
  })
);

// Delete course
router.delete('/:course_id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateCourseId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;

    const course = await Course.findByIdAndInstructor(course_id, req.user.id);
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    await Course.deleteOne({ id: course_id });

    logger.info(`Course deleted: ${course.title} by ${req.user.email}`);

    res.json({ 
      message: 'Course deleted successfully' 
    });
  })
);

// Get course statistics
router.get('/:course_id/stats',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateCourseId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;
    const course = await Course.findOne({ id: course_id });

    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    // Check access permissions
    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    // Get course statistics
    const Module = require('../models/Module');
    const Assignment = require('../models/Assignment');
    const Quiz = require('../models/Quiz');
    const Discussion = require('../models/Discussion');
    const Enrollment = require('../models/Enrollment');

    const [
      modulesCount,
      assignmentsCount,
      quizzesCount,
      discussionsCount,
      enrollmentsCount
    ] = await Promise.all([
      Module.countDocuments({ course_id }),
      Assignment.countDocuments({ course_id }),
      Quiz.countDocuments({ course_id }),
      Discussion.countDocuments({ course_id }),
      Enrollment.countDocuments({ course_id })
    ]);

    res.json({
      modules: modulesCount,
      assignments: assignmentsCount,
      quizzes: quizzesCount,
      discussions: discussionsCount,
      enrollments: enrollmentsCount,
      max_students: course.max_students,
      is_published: course.is_published
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