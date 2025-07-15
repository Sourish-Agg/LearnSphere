module.exports = {
  USER_ROLES: {
    ADMIN: 'admin',
    INSTRUCTOR: 'instructor',
    STUDENT: 'student'
  },
  
  CONTENT_TYPES: {
    TEXT: 'text',
    VIDEO: 'video',
    PDF: 'pdf',
    LINK: 'link'
  },
  
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-here-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30m',
  
  DB_COLLECTIONS: {
    USERS: 'users',
    COURSES: 'courses',
    MODULES: 'modules',
    ASSIGNMENTS: 'assignments',
    SUBMISSIONS: 'submissions',
    QUIZZES: 'quizzes',
    QUIZ_ATTEMPTS: 'quiz_attempts',
    DISCUSSIONS: 'discussions',
    REPLIES: 'replies',
    ENROLLMENTS: 'enrollments'
  },
  
  DEFAULT_VALUES: {
    COURSE_DURATION: 8,
    COURSE_MAX_STUDENTS: 50,
    QUIZ_DURATION: 30,
    QUIZ_MAX_ATTEMPTS: 3,
    ASSIGNMENT_MAX_SCORE: 100
  }
};