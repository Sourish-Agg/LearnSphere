const express = require('express');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Discussion = require('../models/Discussion');
const AuthMiddleware = require('../middleware/auth');
const ErrorHandler = require('../middleware/errorHandler');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

// Get dashboard statistics
router.get('/stats',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const { role } = req.user;

    let stats = {};

    if (role === USER_ROLES.ADMIN) {
      stats = await getAdminStats();
    } else if (role === USER_ROLES.INSTRUCTOR) {
      stats = await getInstructorStats(req.user.id);
    } else if (role === USER_ROLES.STUDENT) {
      stats = await getStudentStats(req.user.id);
    }

    stats.role = role;
    res.json(stats);
  })
);

// Get detailed analytics for admin
router.get('/analytics',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [
      newUsers,
      newCourses,
      newEnrollments,
      usersByRole,
      coursesByStatus,
      enrollmentsByMonth
    ] = await Promise.all([
      User.countDocuments({ created_at: { $gte: startDate } }),
      Course.countDocuments({ created_at: { $gte: startDate } }),
      Enrollment.countDocuments({ enrolled_at: { $gte: startDate } }),
      getUsersByRole(),
      getCoursesByStatus(),
      getEnrollmentsByMonth()
    ]);

    res.json({
      period,
      new_users: newUsers,
      new_courses: newCourses,
      new_enrollments: newEnrollments,
      users_by_role: usersByRole,
      courses_by_status: coursesByStatus,
      enrollments_by_month: enrollmentsByMonth
    });
  })
);

// Get instructor performance metrics
router.get('/instructor-metrics',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const instructorId = req.user.id;

    const [
      courses,
      totalStudents,
      avgRating,
      completionRate,
      recentActivity
    ] = await Promise.all([
      Course.findByInstructor(instructorId),
      getTotalStudentsForInstructor(instructorId),
      getAverageRatingForInstructor(instructorId),
      getCompletionRateForInstructor(instructorId),
      getRecentActivityForInstructor(instructorId)
    ]);

    res.json({
      total_courses: courses.length,
      published_courses: courses.filter(c => c.is_published).length,
      total_students: totalStudents,
      average_rating: avgRating,
      completion_rate: completionRate,
      recent_activity: recentActivity
    });
  })
);

// Get student performance metrics
router.get('/student-metrics',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireStudent(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const studentId = req.user.id;

    const [
      enrollments,
      submissions,
      quizAttempts,
      averageGrade,
      recentActivity
    ] = await Promise.all([
      Enrollment.findByStudent(studentId),
      Submission.findByStudent(studentId),
      QuizAttempt.findByStudent(studentId),
      getAverageGradeForStudent(studentId),
      getRecentActivityForStudent(studentId)
    ]);

    const completedCourses = enrollments.filter(e => e.completed).length;
    const inProgressCourses = enrollments.filter(e => !e.completed).length;

    res.json({
      enrolled_courses: enrollments.length,
      completed_courses: completedCourses,
      in_progress_courses: inProgressCourses,
      total_submissions: submissions.length,
      total_quiz_attempts: quizAttempts.length,
      average_grade: averageGrade,
      recent_activity: recentActivity
    });
  })
);

// Helper functions

async function getAdminStats() {
  const [
    totalUsers,
    totalCourses,
    totalEnrollments,
    totalAssignments,
    totalDiscussions
  ] = await Promise.all([
    User.countDocuments({}),
    Course.countDocuments({}),
    Enrollment.countDocuments({}),
    Assignment.countDocuments({}),
    Discussion.countDocuments({})
  ]);

  return {
    total_users: totalUsers,
    total_courses: totalCourses,
    total_enrollments: totalEnrollments,
    total_assignments: totalAssignments,
    total_discussions: totalDiscussions
  };
}

async function getInstructorStats(instructorId) {
  const courses = await Course.findByInstructor(instructorId);
  const courseIds = courses.map(course => course.id);

  const [
    totalStudents,
    totalAssignments,
    totalSubmissions
  ] = await Promise.all([
    Enrollment.countDocuments({ course_id: { $in: courseIds } }),
    Assignment.countDocuments({ course_id: { $in: courseIds } }),
    getSubmissionsForCourses(courseIds)
  ]);

  return {
    my_courses: courses.length,
    total_students: totalStudents,
    total_assignments: totalAssignments,
    total_submissions: totalSubmissions
  };
}

async function getStudentStats(studentId) {
  const [
    enrollments,
    submissions,
    quizAttempts
  ] = await Promise.all([
    Enrollment.findByStudent(studentId),
    Submission.findByStudent(studentId),
    QuizAttempt.findByStudent(studentId)
  ]);

  const completedCourses = enrollments.filter(e => e.completed).length;

  return {
    enrolled_courses: enrollments.length,
    completed_courses: completedCourses,
    submitted_assignments: submissions.length,
    quiz_attempts: quizAttempts.length
  };
}

async function getUsersByRole() {
  const results = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);

  return results.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
}

async function getCoursesByStatus() {
  const results = await Course.aggregate([
    { $group: { _id: '$is_published', count: { $sum: 1 } } }
  ]);

  return results.reduce((acc, item) => {
    acc[item._id ? 'published' : 'draft'] = item.count;
    return acc;
  }, {});
}

async function getEnrollmentsByMonth() {
  const results = await Enrollment.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$enrolled_at' },
          month: { $month: '$enrolled_at' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  return results.map(item => ({
    year: item._id.year,
    month: item._id.month,
    count: item.count
  }));
}

async function getTotalStudentsForInstructor(instructorId) {
  const courses = await Course.findByInstructor(instructorId);
  const courseIds = courses.map(course => course.id);
  return Enrollment.countDocuments({ course_id: { $in: courseIds } });
}

async function getAverageRatingForInstructor(instructorId) {
  // This would require a rating system - placeholder for now
  return 4.5;
}

async function getCompletionRateForInstructor(instructorId) {
  const courses = await Course.findByInstructor(instructorId);
  const courseIds = courses.map(course => course.id);
  
  const [totalEnrollments, completedEnrollments] = await Promise.all([
    Enrollment.countDocuments({ course_id: { $in: courseIds } }),
    Enrollment.countDocuments({ course_id: { $in: courseIds }, completed: true })
  ]);

  return totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;
}

async function getRecentActivityForInstructor(instructorId) {
  const courses = await Course.findByInstructor(instructorId);
  const courseIds = courses.map(course => course.id);
  
  const [recentEnrollments, recentSubmissions] = await Promise.all([
    Enrollment.find({ course_id: { $in: courseIds } })
      .sort({ enrolled_at: -1 })
      .limit(5),
    getRecentSubmissionsForCourses(courseIds)
  ]);

  return {
    recent_enrollments: recentEnrollments.length,
    recent_submissions: recentSubmissions.length
  };
}

async function getAverageGradeForStudent(studentId) {
  const submissions = await Submission.find({ 
    student_id: studentId, 
    score: { $ne: null } 
  });

  if (submissions.length === 0) return 0;

  const totalScore = submissions.reduce((sum, sub) => sum + sub.score, 0);
  return Math.round(totalScore / submissions.length);
}

async function getRecentActivityForStudent(studentId) {
  const [recentSubmissions, recentQuizAttempts] = await Promise.all([
    Submission.find({ student_id: studentId })
      .sort({ submitted_at: -1 })
      .limit(5),
    QuizAttempt.find({ student_id: studentId })
      .sort({ started_at: -1 })
      .limit(5)
  ]);

  return {
    recent_submissions: recentSubmissions.length,
    recent_quiz_attempts: recentQuizAttempts.length
  };
}

async function getSubmissionsForCourses(courseIds) {
  const assignments = await Assignment.find({ course_id: { $in: courseIds } });
  const assignmentIds = assignments.map(a => a.id);
  return Submission.countDocuments({ assignment_id: { $in: assignmentIds } });
}

async function getRecentSubmissionsForCourses(courseIds) {
  const assignments = await Assignment.find({ course_id: { $in: courseIds } });
  const assignmentIds = assignments.map(a => a.id);
  return Submission.find({ assignment_id: { $in: assignmentIds } })
    .sort({ submitted_at: -1 })
    .limit(10);
}

module.exports = router;