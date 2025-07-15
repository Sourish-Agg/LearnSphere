const express = require('express');
const Module = require('../models/Module');
const Course = require('../models/Course');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

// Create new module
router.post('/:course_id/modules',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateModuleCreation(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id } = req.params;
    const moduleData = req.validatedData;

    // Check if course exists and instructor owns it
    const course = await Course.findByIdAndInstructor(course_id, req.user.id);
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    moduleData.course_id = course_id;
    const module = new Module(moduleData);
    await module.save();

    logger.info(`Module created: ${module.title} in course: ${course.title}`);

    res.status(201).json(module.toJSON());
  })
);

// Get all modules for a course
router.get('/:course_id/modules',
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

    const modules = await Module.findByCourse(course_id);
    const cleanModules = modules.map(module => module.toJSON());

    res.json(cleanModules);
  })
);

// Get specific module
router.get('/:course_id/modules/:module_id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateModuleId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id, module_id } = req.params;

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

    const module = await Module.findByCourseAndId(course_id, module_id);
    if (!module) {
      return res.status(404).json({ 
        detail: 'Module not found' 
      });
    }

    res.json(module.toJSON());
  })
);

// Update module
router.put('/:course_id/modules/:module_id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateModuleId(),
  ValidationMiddleware.validateModuleCreation(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id, module_id } = req.params;
    const updateData = req.validatedData;

    // Check if course exists and instructor owns it
    const course = await Course.findByIdAndInstructor(course_id, req.user.id);
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    const module = await Module.findByCourseAndId(course_id, module_id);
    if (!module) {
      return res.status(404).json({ 
        detail: 'Module not found' 
      });
    }

    // Update module fields
    Object.keys(updateData).forEach(key => {
      module[key] = updateData[key];
    });

    await module.save();

    logger.info(`Module updated: ${module.title} in course: ${course.title}`);

    res.json(module.toJSON());
  })
);

// Delete module
router.delete('/:course_id/modules/:module_id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructor(),
  ValidationMiddleware.validateCourseId(),
  ValidationMiddleware.validateModuleId(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { course_id, module_id } = req.params;

    // Check if course exists and instructor owns it
    const course = await Course.findByIdAndInstructor(course_id, req.user.id);
    if (!course) {
      return res.status(404).json({ 
        detail: 'Course not found' 
      });
    }

    const module = await Module.findByCourseAndId(course_id, module_id);
    if (!module) {
      return res.status(404).json({ 
        detail: 'Module not found' 
      });
    }

    await Module.deleteOne({ id: module_id });

    logger.info(`Module deleted: ${module.title} from course: ${course.title}`);

    res.json({ 
      message: 'Module deleted successfully' 
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