const express = require('express');
const axios = require('axios');
const Course = require('../models/Course');
const Module = require('../models/Module');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const router = express.Router();

// Coursera API Configuration
const COURSERA_API_BASE = 'https://api.coursera.org/api';
const COURSERA_TOKEN_URL = 'https://accounts.coursera.org/oauth2/v1/token';

// Get Coursera access token
async function getCourseraToken() {
  try {
    const response = await axios.post(COURSERA_TOKEN_URL, {
      grant_type: 'client_credentials',
      client_id: process.env.COURSERA_CLIENT_ID || 'placeholder_client_id',
      client_secret: process.env.COURSERA_CLIENT_SECRET || 'placeholder_client_secret'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    logger.error('Failed to get Coursera token:', error.message);
    throw new Error('Failed to authenticate with Coursera API');
  }
}

// Search Coursera courses
router.get('/search',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { query, limit = 10, start = 0 } = req.query;

    if (!query) {
      return res.status(400).json({ 
        detail: 'Search query is required' 
      });
    }

    try {
      // Check if we have real credentials
      if (process.env.COURSERA_CLIENT_ID === 'placeholder_client_id') {
        // Return mock data for demo purposes
        const mockCourses = [
          {
            id: 'machine-learning-001',
            name: 'Machine Learning',
            slug: 'machine-learning',
            description: 'Learn the fundamentals of machine learning with Andrew Ng',
            photoUrl: 'https://example.com/ml-course.jpg',
            workload: '7-10 hours/week',
            partners: ['Stanford University'],
            categories: ['Data Science', 'Machine Learning']
          },
          {
            id: 'python-data-structures-002',
            name: 'Python Data Structures',
            slug: 'python-data-structures',
            description: 'Learn about data structures and algorithms in Python',
            photoUrl: 'https://example.com/python-course.jpg',
            workload: '4-6 hours/week',
            partners: ['University of Michigan'],
            categories: ['Programming', 'Python']
          },
          {
            id: 'web-design-003',
            name: 'Introduction to Web Design',
            slug: 'web-design',
            description: 'Learn the basics of web design and development',
            photoUrl: 'https://example.com/web-design.jpg',
            workload: '5-7 hours/week',
            partners: ['University of California'],
            categories: ['Web Development', 'Design']
          }
        ];

        const filteredCourses = mockCourses.filter(course => 
          course.name.toLowerCase().includes(query.toLowerCase()) ||
          course.description.toLowerCase().includes(query.toLowerCase())
        );

        return res.json({
          courses: filteredCourses,
          total: filteredCourses.length,
          paging: {
            start,
            limit,
            total: filteredCourses.length
          },
          message: 'Using demo data - Add real Coursera credentials to .env file'
        });
      }

      const token = await getCourseraToken();
      
      const response = await axios.get(`${COURSERA_API_BASE}/courses.v1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          q: 'search',
          query,
          limit,
          start,
          fields: 'name,slug,description,photoUrl,workload,partners,categories'
        }
      });

      const courses = response.data.elements || [];
      
      res.json({
        courses: courses.map(course => ({
          id: course.id,
          name: course.name,
          slug: course.slug,
          description: course.description,
          photoUrl: course.photoUrl,
          workload: course.workload,
          partners: course.partners || [],
          categories: course.categories || []
        })),
        total: response.data.paging?.total || courses.length,
        paging: response.data.paging || { start, limit, total: courses.length }
      });

    } catch (error) {
      logger.error('Coursera search error:', error.message);
      res.status(500).json({ 
        detail: 'Failed to search Coursera courses',
        error: error.message 
      });
    }
  })
);

// Get course details from Coursera
router.get('/course/:coursera_id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { coursera_id } = req.params;

    try {
      // Check if we have real credentials
      if (process.env.COURSERA_CLIENT_ID === 'placeholder_client_id') {
        // Return mock data for demo purposes
        const mockCourseDetails = {
          id: coursera_id,
          name: 'Machine Learning',
          slug: 'machine-learning',
          description: 'This course provides a broad introduction to machine learning, datamining, and statistical pattern recognition.',
          photoUrl: 'https://example.com/ml-course.jpg',
          workload: '7-10 hours/week',
          partners: ['Stanford University'],
          categories: ['Data Science', 'Machine Learning'],
          instructors: ['Andrew Ng'],
          modules: [
            {
              id: 'week-1',
              name: 'Introduction to Machine Learning',
              description: 'Welcome to Machine Learning! In this module, we introduce the core idea of teaching a computer to learn concepts using data.',
              lessons: [
                {
                  id: 'lesson-1',
                  name: 'What is Machine Learning?',
                  contentType: 'video',
                  duration: '8:10'
                },
                {
                  id: 'lesson-2',
                  name: 'Supervised Learning',
                  contentType: 'video',
                  duration: '12:15'
                }
              ]
            },
            {
              id: 'week-2',
              name: 'Linear Regression',
              description: 'This week, we focus on linear regression with one variable.',
              lessons: [
                {
                  id: 'lesson-3',
                  name: 'Linear Regression with One Variable',
                  contentType: 'video',
                  duration: '15:30'
                },
                {
                  id: 'lesson-4',
                  name: 'Cost Function',
                  contentType: 'video',
                  duration: '10:45'
                }
              ]
            }
          ]
        };

        return res.json({
          course: mockCourseDetails,
          message: 'Using demo data - Add real Coursera credentials to .env file'
        });
      }

      const token = await getCourseraToken();
      
      const response = await axios.get(`${COURSERA_API_BASE}/courses.v1/${coursera_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          fields: 'name,slug,description,photoUrl,workload,partners,categories,instructors'
        }
      });

      const course = response.data.elements[0];
      
      // Get course modules/syllabus
      const modulesResponse = await axios.get(`${COURSERA_API_BASE}/onDemandCourseMaterials.v1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          q: 'course',
          courseId: coursera_id,
          fields: 'name,description,lessons'
        }
      });

      const modules = modulesResponse.data.elements || [];

      res.json({
        course: {
          id: course.id,
          name: course.name,
          slug: course.slug,
          description: course.description,
          photoUrl: course.photoUrl,
          workload: course.workload,
          partners: course.partners || [],
          categories: course.categories || [],
          instructors: course.instructors || [],
          modules: modules.map(module => ({
            id: module.id,
            name: module.name,
            description: module.description,
            lessons: module.lessons || []
          }))
        }
      });

    } catch (error) {
      logger.error('Coursera course details error:', error.message);
      res.status(500).json({ 
        detail: 'Failed to get course details from Coursera',
        error: error.message 
      });
    }
  })
);

// Import course from Coursera
router.post('/import/:coursera_id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { coursera_id } = req.params;
    const { customize_title, customize_description } = req.body;

    try {
      // Check if we have real credentials
      if (process.env.COURSERA_CLIENT_ID === 'placeholder_client_id') {
        // Create mock course import
        const mockCourse = {
          id: coursera_id,
          name: customize_title || 'Imported Machine Learning Course',
          slug: 'imported-machine-learning',
          description: customize_description || 'This course provides a broad introduction to machine learning, imported from Coursera.',
          modules: [
            {
              id: 'week-1',
              name: 'Introduction to Machine Learning',
              description: 'Welcome to Machine Learning! In this module, we introduce the core idea of teaching a computer to learn concepts using data.',
              lessons: [
                {
                  id: 'lesson-1',
                  name: 'What is Machine Learning?',
                  contentType: 'video',
                  duration: '8:10'
                }
              ]
            }
          ]
        };

        // Create course in our database
        const newCourse = new Course({
          title: mockCourse.name,
          description: mockCourse.description,
          instructor_id: req.user.id,
          duration_weeks: 8,
          max_students: 100,
          is_published: false,
          metadata: {
            source: 'coursera',
            original_id: coursera_id,
            imported_at: new Date()
          }
        });

        await newCourse.save();

        // Create modules
        const createdModules = [];
        for (let i = 0; i < mockCourse.modules.length; i++) {
          const moduleData = mockCourse.modules[i];
          const module = new Module({
            course_id: newCourse.id,
            title: moduleData.name,
            description: moduleData.description,
            content: `Module content for ${moduleData.name}`,
            order: i + 1,
            content_type: 'text'
          });
          
          await module.save();
          createdModules.push(module);
        }

        logger.info(`Course imported from Coursera: ${newCourse.title} by ${req.user.email}`);

        return res.status(201).json({
          message: 'Course imported successfully (demo mode)',
          course: newCourse.toJSON(),
          modules: createdModules.map(m => m.toJSON()),
          note: 'Using demo data - Add real Coursera credentials to .env file'
        });
      }

      // Get course details from Coursera
      const token = await getCourseraToken();
      
      const response = await axios.get(`${COURSERA_API_BASE}/courses.v1/${coursera_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          fields: 'name,slug,description,photoUrl,workload,partners,categories,instructors'
        }
      });

      const courseData = response.data.elements[0];
      
      // Get course modules
      const modulesResponse = await axios.get(`${COURSERA_API_BASE}/onDemandCourseMaterials.v1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          q: 'course',
          courseId: coursera_id,
          fields: 'name,description,lessons'
        }
      });

      const modules = modulesResponse.data.elements || [];

      // Create course in our database
      const newCourse = new Course({
        title: customize_title || courseData.name,
        description: customize_description || courseData.description,
        instructor_id: req.user.id,
        duration_weeks: 8,
        max_students: 100,
        is_published: false,
        metadata: {
          source: 'coursera',
          original_id: coursera_id,
          original_slug: courseData.slug,
          photo_url: courseData.photoUrl,
          workload: courseData.workload,
          partners: courseData.partners,
          categories: courseData.categories,
          instructors: courseData.instructors,
          imported_at: new Date()
        }
      });

      await newCourse.save();

      // Create modules
      const createdModules = [];
      for (let i = 0; i < modules.length; i++) {
        const moduleData = modules[i];
        const module = new Module({
          course_id: newCourse.id,
          title: moduleData.name,
          description: moduleData.description,
          content: `Module content for ${moduleData.name}`,
          order: i + 1,
          content_type: 'text'
        });
        
        await module.save();
        createdModules.push(module);
      }

      logger.info(`Course imported from Coursera: ${newCourse.title} by ${req.user.email}`);

      res.status(201).json({
        message: 'Course imported successfully',
        course: newCourse.toJSON(),
        modules: createdModules.map(m => m.toJSON())
      });

    } catch (error) {
      logger.error('Coursera import error:', error.message);
      res.status(500).json({ 
        detail: 'Failed to import course from Coursera',
        error: error.message 
      });
    }
  })
);

// Get import history
router.get('/imports',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const query = {
      'metadata.source': 'coursera'
    };

    if (req.user.role === USER_ROLES.INSTRUCTOR) {
      query.instructor_id = req.user.id;
    }

    const importedCourses = await Course.find(query)
      .sort({ created_at: -1 })
      .limit(50);

    const coursesWithStats = [];
    for (const course of importedCourses) {
      const modules = await Module.findByCourse(course.id);
      coursesWithStats.push({
        ...course.toJSON(),
        modules_count: modules.length
      });
    }

    res.json({
      imported_courses: coursesWithStats,
      total: importedCourses.length
    });
  })
);

// Test Coursera API connection
router.get('/test-connection',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireInstructorOrAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    try {
      if (process.env.COURSERA_CLIENT_ID === 'placeholder_client_id') {
        return res.json({
          status: 'demo_mode',
          message: 'Using placeholder credentials. Add real Coursera API credentials to .env file.',
          credentials_needed: [
            'COURSERA_CLIENT_ID',
            'COURSERA_CLIENT_SECRET'
          ]
        });
      }

      const token = await getCourseraToken();
      
      // Test with a simple API call
      const response = await axios.get(`${COURSERA_API_BASE}/courses.v1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit: 1
        }
      });

      res.json({
        status: 'connected',
        message: 'Successfully connected to Coursera API',
        api_response: response.status === 200 ? 'OK' : 'Error'
      });

    } catch (error) {
      logger.error('Coursera connection test error:', error.message);
      res.status(500).json({
        status: 'error',
        message: 'Failed to connect to Coursera API',
        error: error.message,
        troubleshooting: [
          'Check if COURSERA_CLIENT_ID and COURSERA_CLIENT_SECRET are set in .env',
          'Verify credentials are valid in Coursera Developer Portal',
          'Ensure API quota is not exceeded'
        ]
      });
    }
  })
);

module.exports = router;