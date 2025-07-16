const express = require('express');
const Progress = require('../models/Progress');
const Course = require('../models/Course');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

// Get student progress for a specific course
router.get('/student/:student_id/course/:course_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateStudentId(),
  ValidationMiddleware.validateCourseId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { student_id, course_id } = req.params;

    // Check if user has access to view this progress
    if (req.user.role === USER_ROLES.STUDENT && req.user.id !== student_id) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    // Check if course exists
    const course = await Course.findOne({ id: course_id });
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    // Check if student is enrolled
    const enrollment = await Enrollment.findByStudentAndCourse(student_id, course_id);
    if (!enrollment) {
      return res.status(404).json({ 
        detail: 'Student not enrolled in this course' 
      });
    }

    // Get detailed progress
    const progressItems = await Progress.findByStudentAndCourse(student_id, course_id);
    const progressSummary = await Progress.getStudentCourseProgress(student_id, course_id);

    res.json({
      course_id,
      student_id,
      summary: progressSummary,
      details: progressItems.map(p => p.toJSON())
    });
  })
);

// Get progress for all students in a course (instructor view)
router.get('/course/:course_id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  ValidationMiddleware.validateCourseId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;

    // Check if course exists and instructor has access
    const course = await Course.findOne({ id: course_id });
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    if (req.user.role === USER_ROLES.INSTRUCTOR && course.instructor_id !== req.user.id) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    // Get all enrolled students
    const enrollments = await Enrollment.findByCourse(course_id);
    const studentIds = enrollments.map(e => e.student_id);

    // Get progress for all students
    const studentsProgress = [];
    for (const studentId of studentIds) {
      const student = await User.findOne({ id: studentId });
      const progressSummary = await Progress.getStudentCourseProgress(studentId, course_id);
      
      studentsProgress.push({
        student_id: studentId,
        student_name: student ? student.full_name : 'Unknown',
        student_email: student ? student.email : 'Unknown',
        progress: progressSummary
      });
    }

    // Course-wide statistics
    const totalStudents = studentsProgress.length;
    const completedStudents = studentsProgress.filter(s => s.progress.overall_progress === 100).length;
    const averageProgress = totalStudents > 0 
      ? Math.round(studentsProgress.reduce((sum, s) => sum + s.progress.overall_progress, 0) / totalStudents)
      : 0;

    res.json({
      course_id,
      course_title: course.title,
      statistics: {
        total_students: totalStudents,
        completed_students: completedStudents,
        average_progress: averageProgress,
        completion_rate: totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0
      },
      students: studentsProgress
    });
  })
);

// Update progress for a specific item
router.put('/update/:progress_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateProgressId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { progress_id } = req.params;
    const { progress_percentage, time_spent_minutes, score } = req.body;

    const progress = await Progress.findOne({ id: progress_id });
    if (!progress) {
      return res.status(404).json({ 
        detail: 'Progress record not found' 
      });
    }

    // Students can only update their own progress
    if (req.user.role === USER_ROLES.STUDENT && req.user.id !== progress.student_id) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    // Update progress
    if (progress_percentage !== undefined) {
      progress.updateProgress(progress_percentage, time_spent_minutes || 0);
    }

    if (score !== undefined && progress.max_score !== null) {
      progress.score = Math.min(score, progress.max_score);
    }

    // Check if item is overdue
    progress.checkOverdue();

    await progress.save();

    logger.info(`Progress updated: ${progress.item_type} for student ${progress.student_id}`);

    res.json(progress.getProgressSummary());
  })
);

// Mark item as completed
router.post('/complete/:progress_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateProgressId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { progress_id } = req.params;
    const { score, time_spent_minutes } = req.body;

    const progress = await Progress.findOne({ id: progress_id });
    if (!progress) {
      return res.status(404).json({ 
        detail: 'Progress record not found' 
      });
    }

    // Students can only update their own progress
    if (req.user.role === USER_ROLES.STUDENT && req.user.id !== progress.student_id) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    // Mark as completed
    progress.markAsCompleted();

    if (time_spent_minutes) {
      progress.time_spent_minutes += time_spent_minutes;
    }

    if (score !== undefined && progress.max_score !== null) {
      progress.score = Math.min(score, progress.max_score);
    }

    await progress.save();

    logger.info(`Item completed: ${progress.item_type} by student ${progress.student_id}`);

    res.json(progress.getProgressSummary());
  })
);

// Get overdue items
router.get('/overdue',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const { student_id, course_id } = req.query;

    let overdueItems;
    if (req.user.role === USER_ROLES.STUDENT) {
      // Students can only see their own overdue items
      overdueItems = await Progress.getOverdueItems(req.user.id, course_id);
    } else {
      // Instructors and admins can see all overdue items
      overdueItems = await Progress.getOverdueItems(student_id, course_id);
    }

    // Add additional info for each overdue item
    const enrichedItems = [];
    for (const item of overdueItems) {
      const student = await User.findOne({ id: item.student_id });
      const course = await Course.findOne({ id: item.course_id });
      
      enrichedItems.push({
        ...item.toJSON(),
        student_name: student ? student.full_name : 'Unknown',
        course_title: course ? course.title : 'Unknown',
        days_overdue: Math.abs(item.getDaysUntilDue())
      });
    }

    res.json(enrichedItems);
  })
);

// Get upcoming deadlines
router.get('/upcoming-deadlines',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireStudent(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;
    const studentId = req.user.id;

    const upcomingItems = await Progress.getUpcomingDeadlines(studentId, parseInt(days));

    // Add additional info for each upcoming item
    const enrichedItems = [];
    for (const item of upcomingItems) {
      const course = await Course.findOne({ id: item.course_id });
      
      enrichedItems.push({
        ...item.toJSON(),
        course_title: course ? course.title : 'Unknown',
        days_until_due: item.getDaysUntilDue()
      });
    }

    res.json(enrichedItems);
  })
);

// Initialize progress for a student in a course
router.post('/initialize',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const { student_id, course_id } = req.body;

    // Validate required fields
    if (!student_id || !course_id) {
      return res.status(400).json({ 
        detail: 'student_id and course_id are required' 
      });
    }

    // Check permissions
    if (req.user.role === USER_ROLES.STUDENT && req.user.id !== student_id) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    // Check if student is enrolled
    const enrollment = await Enrollment.findByStudentAndCourse(student_id, course_id);
    if (!enrollment) {
      return res.status(404).json({ 
        detail: 'Student not enrolled in this course' 
      });
    }

    // Initialize progress
    const success = await Progress.initializeStudentProgress(student_id, course_id);
    if (!success) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    logger.info(`Progress initialized for student ${student_id} in course ${course_id}`);

    res.json({
      message: 'Progress initialized successfully',
      student_id,
      course_id
    });
  })
);

// Get dashboard summary for student
router.get('/dashboard',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireStudent(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const studentId = req.user.id;

    // Get all enrollments for the student
    const enrollments = await Enrollment.findByStudent(studentId);
    const coursesProgress = [];

    for (const enrollment of enrollments) {
      const course = await Course.findOne({ id: enrollment.course_id });
      const progressSummary = await Progress.getStudentCourseProgress(studentId, enrollment.course_id);
      
      coursesProgress.push({
        course_id: enrollment.course_id,
        course_title: course ? course.title : 'Unknown',
        enrolled_at: enrollment.enrolled_at,
        progress: progressSummary
      });
    }

    // Get overdue items
    const overdueItems = await Progress.getOverdueItems(studentId);
    
    // Get upcoming deadlines
    const upcomingDeadlines = await Progress.getUpcomingDeadlines(studentId, 7);

    // Calculate overall statistics
    const totalCourses = coursesProgress.length;
    const completedCourses = coursesProgress.filter(c => c.progress.overall_progress === 100).length;
    const averageProgress = totalCourses > 0 
      ? Math.round(coursesProgress.reduce((sum, c) => sum + c.progress.overall_progress, 0) / totalCourses)
      : 0;

    res.json({
      student_id: studentId,
      summary: {
        total_courses: totalCourses,
        completed_courses: completedCourses,
        average_progress: averageProgress,
        overdue_items: overdueItems.length,
        upcoming_deadlines: upcomingDeadlines.length
      },
      courses: coursesProgress,
      overdue_items: overdueItems.slice(0, 5), // Show only first 5
      upcoming_deadlines: upcomingDeadlines.slice(0, 5) // Show only first 5
    });
  })
);

module.exports = router;