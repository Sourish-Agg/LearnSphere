const Validators = require('../utils/validators');
const logger = require('../utils/logger');

class ValidationMiddleware {
  // Generic validation middleware
  static validate(schema) {
    return (req, res, next) => {
      try {
        const validatedData = Validators.validate(schema, req.body);
        req.validatedData = validatedData;
        next();
      } catch (error) {
        logger.error(`Validation error: ${error.message}`);
        res.status(400).json({ 
          detail: error.message 
        });
      }
    };
  }

  // User validation middlewares
  static validateUserRegistration() {
    return ValidationMiddleware.validate(Validators.userRegisterSchema);
  }

  static validateUserLogin() {
    return ValidationMiddleware.validate(Validators.userLoginSchema);
  }

  // Course validation middlewares
  static validateCourseCreation() {
    return ValidationMiddleware.validate(Validators.courseCreateSchema);
  }

  static validateCourseUpdate() {
    return ValidationMiddleware.validate(Validators.courseUpdateSchema);
  }

  // Module validation middlewares
  static validateModuleCreation() {
    return ValidationMiddleware.validate(Validators.moduleCreateSchema);
  }

  // Assignment validation middlewares
  static validateAssignmentCreation() {
    return ValidationMiddleware.validate(Validators.assignmentCreateSchema);
  }

  static validateSubmissionCreation() {
    return ValidationMiddleware.validate(Validators.submissionCreateSchema);
  }

  static validateGradeSubmission() {
    return ValidationMiddleware.validate(Validators.gradeSubmissionSchema);
  }

  // Quiz validation middlewares
  static validateQuizCreation() {
    return ValidationMiddleware.validate(Validators.quizCreateSchema);
  }

  static validateQuizAttempt() {
    return ValidationMiddleware.validate(Validators.quizAttemptSchema);
  }

  // Discussion validation middlewares
  static validateDiscussionCreation() {
    return ValidationMiddleware.validate(Validators.discussionCreateSchema);
  }

  static validateReplyCreation() {
    return ValidationMiddleware.validate(Validators.replyCreateSchema);
  }

  // Enrollment validation middlewares
  static validateEnrollmentCreation() {
    return ValidationMiddleware.validate(Validators.enrollmentCreateSchema);
  }

  // Validate UUID parameters
  static validateUUID(paramName) {
    return (req, res, next) => {
      const value = req.params[paramName];
      if (!value || !Validators.isValidUUID(value)) {
        return res.status(400).json({ 
          detail: `Invalid ${paramName} format` 
        });
      }
      next();
    };
  }

  // Validate course ID parameter
  static validateCourseId() {
    return ValidationMiddleware.validateUUID('course_id');
  }

  // Validate module ID parameter
  static validateModuleId() {
    return ValidationMiddleware.validateUUID('module_id');
  }

  // Validate assignment ID parameter
  static validateAssignmentId() {
    return ValidationMiddleware.validateUUID('assignment_id');
  }

  // Validate quiz ID parameter
  static validateQuizId() {
    return ValidationMiddleware.validateUUID('quiz_id');
  }

  // Validate discussion ID parameter
  static validateDiscussionId() {
    return ValidationMiddleware.validateUUID('discussion_id');
  }

  // Validate submission ID parameter
  static validateSubmissionId() {
    return ValidationMiddleware.validateUUID('submission_id');
  }

  // Progress validation middlewares
  static validateProgressId() {
    return ValidationMiddleware.validateParam('progress_id');
  }

  static validateStudentId() {
    return ValidationMiddleware.validateParam('student_id');
  }

  // Generic parameter validation
  static validateParam(paramName) {
    return (req, res, next) => {
      const value = req.params[paramName];
      if (!value || typeof value !== 'string' || value.trim() === '') {
        return res.status(400).json({
          detail: `Invalid ${paramName} parameter`
        });
      }
      next();
    };
  }
}

module.exports = ValidationMiddleware;