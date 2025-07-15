const express = require('express');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const User = require('../models/User');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

// Enroll in a course
router.post('/',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireStudent(),
  ValidationMiddleware.validateEnrollmentCreation(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.validatedData;
    const student_id = req.user.id;

    // Check if course exists
    const course = await Course.findOne({ id: course_id });
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    // Check if course is published
    if (!course.is_published) {
      return res.status(400).json({ 
        detail: 'Course is not published' 
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findByStudentAndCourse(student_id, course_id);
    if (existingEnrollment) {
      return res.status(400).json({ 
        detail: 'Already enrolled in this course' 
      });
    }

    // Check if course is full
    const currentEnrollments = await Enrollment.getCourseEnrollmentCount(course_id);
    if (currentEnrollments >= course.max_students) {
      return res.status(400).json({ 
        detail: 'Course is full' 
      });
    }

    // Create enrollment
    const enrollment = new Enrollment({
      student_id,
      course_id
    });

    await enrollment.save();

    // Update course enrolled_students array
    course.enrollStudent(student_id);
    await course.save();

    logger.info(`Student enrolled: ${req.user.email} in course: ${course.title}`);

    res.status(201).json(enrollment.toJSON());
  })
);

// Get user's enrollments
router.get('/',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    let enrollments;
    
    if (req.user.role === USER_ROLES.STUDENT) {
      enrollments = await Enrollment.findByStudent(req.user.id);
    } else if (req.user.role === USER_ROLES.INSTRUCTOR) {
      // Get enrollments for instructor's courses
      const instructorCourses = await Course.findByInstructor(req.user.id);
      const courseIds = instructorCourses.map(course => course.id);
      enrollments = await Enrollment.find({ course_id: { $in: courseIds } });
    } else {
      // Admin can see all enrollments
      enrollments = await Enrollment.find().sort({ enrolled_at: -1 });
    }

    // Add course and student info
    const enrichedEnrollments = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = await Course.findOne({ id: enrollment.course_id });
        const student = await User.findOne({ id: enrollment.student_id });
        
        const result = {
          enrollment: enrollment.toJSON(),
          course: course ? course.toJSON() : null
        };

        // Add student info for instructors and admins
        if (req.user.role !== USER_ROLES.STUDENT) {
          result.student = student ? student.getSafeUser() : null;
        }

        return result;
      })
    );

    res.json(enrichedEnrollments);
  })
);

// Get enrollment by ID
router.get('/:enrollment_id',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const { enrollment_id } = req.params;

    const enrollment = await Enrollment.findOne({ id: enrollment_id });
    if (!enrollment) {
      return res.status(404).json({ 
        detail: 'Enrollment not found' 
      });
    }

    // Check access permissions
    const course = await Course.findOne({ id: enrollment.course_id });
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    const canAccess = enrollment.student_id === req.user.id ||
                     (req.user.role === USER_ROLES.INSTRUCTOR && course.instructor_id === req.user.id) ||
                     req.user.role === USER_ROLES.ADMIN;

    if (!canAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    const student = await User.findOne({ id: enrollment.student_id });
    
    res.json({
      enrollment: enrollment.toJSON(),
      course: course.toJSON(),
      student: student ? student.getSafeUser() : null
    });
  })
);

// Update enrollment progress
router.put('/:enrollment_id/progress',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { enrollment_id } = req.params;
    const { progress } = req.body;

    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return res.status(400).json({ 
        detail: 'Progress must be a number between 0 and 100' 
      });
    }

    const enrollment = await Enrollment.findOne({ id: enrollment_id });
    if (!enrollment) {
      return res.status(404).json({ 
        detail: 'Enrollment not found' 
      });
    }

    // Check if instructor owns the course
    const course = await Course.findOne({ id: enrollment.course_id, instructor_id: req.user.id });
    if (!course) {
      return res.status(403).json({ 
        detail: 'Not authorized' 
      });
    }

    enrollment.updateProgress(progress);
    await enrollment.save();

    logger.info(`Enrollment progress updated: ${progress}% for student in course: ${course.title}`);

    res.json(enrollment.toJSON());
  })
);

// Mark enrollment as completed
router.put('/:enrollment_id/complete',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { enrollment_id } = req.params;

    const enrollment = await Enrollment.findOne({ id: enrollment_id });
    if (!enrollment) {
      return res.status(404).json({ 
        detail: 'Enrollment not found' 
      });
    }

    // Check if instructor owns the course
    const course = await Course.findOne({ id: enrollment.course_id, instructor_id: req.user.id });
    if (!course) {
      return res.status(403).json({ 
        detail: 'Not authorized' 
      });
    }

    enrollment.markCompleted();
    await enrollment.save();

    logger.info(`Enrollment completed for student in course: ${course.title}`);

    res.json(enrollment.toJSON());
  })
);

// Unenroll from course
router.delete('/:enrollment_id',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const { enrollment_id } = req.params;

    const enrollment = await Enrollment.findOne({ id: enrollment_id });
    if (!enrollment) {
      return res.status(404).json({ 
        detail: 'Enrollment not found' 
      });
    }

    // Check permissions - student can unenroll themselves, instructor can unenroll students from their courses
    const course = await Course.findOne({ id: enrollment.course_id });
    const canUnenroll = enrollment.student_id === req.user.id ||
                       (req.user.role === USER_ROLES.INSTRUCTOR && course.instructor_id === req.user.id) ||
                       req.user.role === USER_ROLES.ADMIN;

    if (!canUnenroll) {
      return res.status(403).json({ 
        detail: 'Not authorized' 
      });
    }

    // Remove enrollment
    await Enrollment.deleteOne({ id: enrollment_id });

    // Update course enrolled_students array
    course.unenrollStudent(enrollment.student_id);
    await course.save();

    logger.info(`Student unenrolled from course: ${course.title}`);

    res.json({ 
      message: 'Unenrolled successfully' 
    });
  })
);

// Get course enrollments (for instructors)
router.get('/course/:course_id',
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

    // Check permissions - instructor must own the course
    if (req.user.role === USER_ROLES.INSTRUCTOR && course.instructor_id !== req.user.id) {
      return res.status(403).json({ 
        detail: 'Not authorized' 
      });
    }

    const enrollments = await Enrollment.findByCourse(course_id);
    
    // Add student info
    const enrichedEnrollments = await Promise.all(
      enrollments.map(async (enrollment) => {
        const student = await User.findOne({ id: enrollment.student_id });
        
        return {
          enrollment: enrollment.toJSON(),
          student: student ? student.getSafeUser() : null
        };
      })
    );

    res.json(enrichedEnrollments);
  })
);

// Get enrollment statistics
router.get('/stats/overview',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    let filter = {};
    
    if (req.user.role === USER_ROLES.INSTRUCTOR) {
      // Get stats for instructor's courses only
      const instructorCourses = await Course.findByInstructor(req.user.id);
      const courseIds = instructorCourses.map(course => course.id);
      filter = { course_id: { $in: courseIds } };
    }

    const [
      totalEnrollments,
      completedEnrollments,
      activeEnrollments
    ] = await Promise.all([
      Enrollment.countDocuments(filter),
      Enrollment.countDocuments({ ...filter, completed: true }),
      Enrollment.countDocuments({ ...filter, completed: false })
    ]);

    res.json({
      total_enrollments: totalEnrollments,
      completed_enrollments: completedEnrollments,
      active_enrollments: activeEnrollments,
      completion_rate: totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0
    });
  })
);

module.exports = router;