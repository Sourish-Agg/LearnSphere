const express = require('express');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Course = require('../models/Course');
const User = require('../models/User');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

// Create new assignment
router.post('/:course_id/assignments',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateAssignmentCreation(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;
    const assignmentData = req.validatedData;

    // Check if course exists and instructor owns it
    const course = await Course.findByIdAndInstructor(course_id, req.user.id);
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    assignmentData.course_id = course_id;
    assignmentData.created_by = req.user.id;
    
    const assignment = new Assignment(assignmentData);
    await assignment.save();

    logger.info(`Assignment created: ${assignment.title} in course: ${course.title}`);

    res.status(201).json(assignment.toJSON());
  })
);

// Get all assignments for a course
router.get('/:course_id/assignments',
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

    const assignments = await Assignment.findByCourse(course_id);
    const cleanAssignments = assignments.map(assignment => assignment.toJSON());

    res.json(cleanAssignments);
  })
);

// Get specific assignment
router.get('/:course_id/assignments/:assignment_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateAssignmentId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id, assignment_id } = req.params;

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

    const assignment = await Assignment.findOne({ id: assignment_id, course_id });
    if (!assignment) {
      return res.status(404).json({ 
        detail: 'Assignment not found' 
      });
    }

    res.json(assignment.toJSON());
  })
);

// Submit assignment
router.post('/assignments/:assignment_id/submissions',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireStudent(),
  ValidationMiddleware.validateAssignmentId(),
  ValidationMiddleware.validateSubmissionCreation(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { assignment_id } = req.params;
    const submissionData = req.validatedData;

    // Check if assignment exists
    const assignment = await Assignment.findOne({ id: assignment_id });
    if (!assignment) {
      return res.status(404).json({ 
        detail: 'Assignment not found' 
      });
    }

    // Check course access
    const course = await Course.findOne({ id: assignment.course_id });
    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    // Check if already submitted
    const existingSubmission = await Submission.findByAssignmentAndStudent(assignment_id, req.user.id);
    if (existingSubmission) {
      return res.status(400).json({ 
        detail: 'Assignment already submitted' 
      });
    }

    submissionData.assignment_id = assignment_id;
    submissionData.student_id = req.user.id;
    
    const submission = new Submission(submissionData);
    await submission.save();

    logger.info(`Assignment submitted: ${assignment.title} by ${req.user.email}`);

    res.status(201).json(submission.toJSON());
  })
);

// Get submissions for an assignment
router.get('/assignments/:assignment_id/submissions',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateAssignmentId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { assignment_id } = req.params;

    const assignment = await Assignment.findOne({ id: assignment_id });
    if (!assignment) {
      return res.status(404).json({ 
        detail: 'Assignment not found' 
      });
    }

    // Check course access
    const course = await Course.findOne({ id: assignment.course_id });
    const hasAccess = await checkCourseAccess(course, req.user);
    if (!hasAccess) {
      return res.status(403).json({ 
        detail: 'Access denied' 
      });
    }

    let submissions;
    if (req.user.role === USER_ROLES.STUDENT) {
      // Students can only see their own submissions
      submissions = await Submission.find({ 
        assignment_id, 
        student_id: req.user.id 
      });
    } else {
      // Instructors can see all submissions
      submissions = await Submission.findByAssignment(assignment_id);
      
      // Add student info for instructors
      for (const submission of submissions) {
        const student = await User.findOne({ id: submission.student_id });
        submission.student_name = student ? student.full_name : 'Unknown';
      }
    }

    const cleanSubmissions = submissions.map(submission => submission.toJSON());
    res.json(cleanSubmissions);
  })
);

// Grade submission
router.put('/submissions/:submission_id/grade',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateSubmissionId(),
  ValidationMiddleware.validateGradeSubmission(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { submission_id } = req.params;
    const { score, feedback } = req.validatedData;

    const submission = await Submission.findOne({ id: submission_id });
    if (!submission) {
      return res.status(404).json({ 
        detail: 'Submission not found' 
      });
    }

    const assignment = await Assignment.findOne({ id: submission.assignment_id });
    if (!assignment) {
      return res.status(404).json({ 
        detail: 'Assignment not found' 
      });
    }

    // Check if instructor owns the course
    const course = await Course.findByIdAndInstructor(assignment.course_id, req.user.id);
    if (!course) {
      return res.status(403).json({ 
        detail: 'Not authorized' 
      });
    }

    // Validate score against max score
    if (score > assignment.max_score) {
      return res.status(400).json({ 
        detail: `Score cannot exceed maximum score of ${assignment.max_score}` 
      });
    }

    submission.grade(score, feedback, req.user.id);
    await submission.save();

    logger.info(`Submission graded: ${assignment.title} - Score: ${score}/${assignment.max_score}`);

    res.json(submission.toJSON());
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