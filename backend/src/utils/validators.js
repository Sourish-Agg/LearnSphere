const Joi = require('joi');
const { USER_ROLES, CONTENT_TYPES } = require('../config/constants');

class Validators {
  // User validation schemas
  static userRegisterSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    full_name: Joi.string().min(2).max(100).required(),
    role: Joi.string().valid(...Object.values(USER_ROLES)).default(USER_ROLES.STUDENT)
  });

  static userLoginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  // Course validation schemas
  static courseCreateSchema = Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(1000).required(),
    duration_weeks: Joi.number().integer().min(1).max(52).default(8),
    max_students: Joi.number().integer().min(1).max(1000).default(50),
    is_published: Joi.boolean().default(false)
  });

  static courseUpdateSchema = Joi.object({
    title: Joi.string().min(3).max(200),
    description: Joi.string().min(10).max(1000),
    duration_weeks: Joi.number().integer().min(1).max(52),
    max_students: Joi.number().integer().min(1).max(1000),
    is_published: Joi.boolean()
  });

  // Module validation schemas
  static moduleCreateSchema = Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(1000).required(),
    content: Joi.string().min(10).required(),
    order: Joi.number().integer().min(1).required(),
    content_type: Joi.string().valid(...Object.values(CONTENT_TYPES)).default(CONTENT_TYPES.TEXT)
  });

  // Assignment validation schemas
  static assignmentCreateSchema = Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(1000).required(),
    due_date: Joi.date().iso().required(),
    max_score: Joi.number().integer().min(1).max(1000).default(100),
    instructions: Joi.string().min(10).required()
  });

  static submissionCreateSchema = Joi.object({
    assignment_id: Joi.string().uuid().required(),
    content: Joi.string().min(10).required(),
    file_path: Joi.string().optional()
  });

  static gradeSubmissionSchema = Joi.object({
    score: Joi.number().integer().min(0).required(),
    feedback: Joi.string().max(1000).default('')
  });

  // Quiz validation schemas
  static quizCreateSchema = Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().min(10).max(1000).required(),
    duration_minutes: Joi.number().integer().min(1).max(180).default(30),
    max_attempts: Joi.number().integer().min(1).max(10).default(3),
    questions: Joi.array().items(
      Joi.object({
        question: Joi.string().min(10).required(),
        options: Joi.array().items(Joi.string().min(1)).length(4).required(),
        correct_answer: Joi.number().integer().min(0).max(3).required(),
        points: Joi.number().integer().min(1).default(1)
      })
    ).min(1).required()
  });

  static quizAttemptSchema = Joi.object({
    quiz_id: Joi.string().uuid().required(),
    answers: Joi.array().items(
      Joi.object({
        answer: Joi.number().integer().min(0).max(3).required()
      })
    ).min(1).required()
  });

  // Discussion validation schemas
  static discussionCreateSchema = Joi.object({
    title: Joi.string().min(3).max(200).required(),
    content: Joi.string().min(10).max(5000).required()
  });

  static replyCreateSchema = Joi.object({
    content: Joi.string().min(1).max(2000).required()
  });

  // Enrollment validation schemas
  static enrollmentCreateSchema = Joi.object({
    course_id: Joi.string().uuid().required()
  });

  // Generic validation method
  static validate(schema, data) {
    const { error, value } = schema.validate(data);
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      throw new Error(errorMessage);
    }
    return value;
  }
}

module.exports = Validators;