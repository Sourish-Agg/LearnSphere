const express = require('express');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Course = require('../models/Course');
const User = require('../models/User');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const Helpers = require('../utils/helpers');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

// Create new quiz
router.post('/:course_id/quizzes',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateQuizCreation(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;
    const quizData = req.validatedData;

    // Check if course exists and instructor owns it
    const course = await Course.findByIdAndInstructor(course_id, req.user.id);
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    quizData.course_id = course_id;
    quizData.created_by = req.user.id;
    
    const quiz = new Quiz(quizData);
    await quiz.save();

    logger.info(`Quiz created: ${quiz.title} in course: ${course.title}`);

    res.status(201).json(quiz.toJSON());
  })
);

// Get all quizzes for a course
router.get('/:course_id/quizzes',
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

    const quizzes = await Quiz.findByCourse(course_id);
    let cleanQuizzes;

    if (req.user.role === USER_ROLES.STUDENT) {
      // For students, hide correct answers
      cleanQuizzes = quizzes.map(quiz => {
        const cleanQuiz = quiz.toJSON();
        cleanQuiz.questions = quiz.getQuestionsForStudent();
        return cleanQuiz;
      });
    } else {
      // For instructors and admins, show all data
      cleanQuizzes = quizzes.map(quiz => quiz.toJSON());
    }

    res.json(cleanQuizzes);
  })
);

// Get specific quiz
router.get('/:course_id/quizzes/:quiz_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateQuizId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id, quiz_id } = req.params;

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

    const quiz = await Quiz.findOne({ id: quiz_id, course_id });
    if (!quiz) {
      return res.status(404).json({ 
        detail: 'Quiz not found' 
      });
    }

    let cleanQuiz;
    if (req.user.role === USER_ROLES.STUDENT) {
      // For students, hide correct answers
      cleanQuiz = quiz.toJSON();
      cleanQuiz.questions = quiz.getQuestionsForStudent();
    } else {
      // For instructors and admins, show all data
      cleanQuiz = quiz.toJSON();
    }

    res.json(cleanQuiz);
  })
);

// Submit quiz attempt
router.post('/quizzes/:quiz_id/attempts',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireStudent(),
  ValidationMiddleware.validateQuizId(),
  ValidationMiddleware.validateQuizAttempt(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { quiz_id } = req.params;
    const attemptData = req.validatedData;

    const quiz = await Quiz.findOne({ id: quiz_id });
    if (!quiz) {
      return res.status(404).json({ 
        detail: 'Quiz not found' 
      });
    }

    // Check course access
    const course = await Course.findOne({ id: quiz.course_id });
    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    // Check attempt limit
    const attemptsCount = await QuizAttempt.getAttemptCount(quiz_id, req.user.id);
    if (attemptsCount >= quiz.max_attempts) {
      return res.status(400).json({ 
        detail: 'Maximum attempts reached' 
      });
    }

    // Calculate score
    const { score, maxScore } = Helpers.calculateQuizScore(quiz.questions, attemptData.answers);

    const attempt = new QuizAttempt({
      quiz_id,
      student_id: req.user.id,
      answers: attemptData.answers,
      score,
      max_score: maxScore,
      attempt_number: attemptsCount + 1,
      completed_at: new Date()
    });

    await attempt.save();

    logger.info(`Quiz attempt submitted: ${quiz.title} by ${req.user.email} - Score: ${score}/${maxScore}`);

    res.status(201).json(attempt.toJSON());
  })
);

// Get quiz attempts
router.get('/quizzes/:quiz_id/attempts',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateQuizId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { quiz_id } = req.params;

    const quiz = await Quiz.findOne({ id: quiz_id });
    if (!quiz) {
      return res.status(404).json({ 
        detail: 'Quiz not found' 
      });
    }

    // Check course access
    const course = await Course.findOne({ id: quiz.course_id });
    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    let attempts;
    if (req.user.role === USER_ROLES.STUDENT) {
      // Students can only see their own attempts
      attempts = await QuizAttempt.findByQuizAndStudent(quiz_id, req.user.id);
    } else {
      // Instructors can see all attempts
      attempts = await QuizAttempt.findByQuiz(quiz_id);
      
      // Add student info for instructors
      for (const attempt of attempts) {
        const student = await User.findOne({ id: attempt.student_id });
        attempt.student_name = student ? student.full_name : 'Unknown';
      }
    }

    const cleanAttempts = attempts.map(attempt => attempt.toJSON());
    res.json(cleanAttempts);
  })
);

// Get quiz statistics
router.get('/quizzes/:quiz_id/stats',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateQuizId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { quiz_id } = req.params;

    const quiz = await Quiz.findOne({ id: quiz_id });
    if (!quiz) {
      return res.status(404).json({ 
        detail: 'Quiz not found' 
      });
    }

    // Check if instructor owns the course
    const course = await Course.findByIdAndInstructor(quiz.course_id, req.user.id);
    if (!course) {
      return res.status(403).json({ 
        detail: 'Not authorized' 
      });
    }

    const attempts = await QuizAttempt.findByQuiz(quiz_id);
    
    if (attempts.length === 0) {
      return res.json({
        total_attempts: 0,
        unique_students: 0,
        average_score: 0,
        highest_score: 0,
        lowest_score: 0
      });
    }

    const scores = attempts.map(attempt => attempt.score);
    const uniqueStudents = new Set(attempts.map(attempt => attempt.student_id));
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    res.json({
      total_attempts: attempts.length,
      unique_students: uniqueStudents.size,
      average_score: Math.round(averageScore * 100) / 100,
      highest_score: highestScore,
      lowest_score: lowestScore,
      max_possible_score: quiz.getTotalPoints()
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