const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const moduleRoutes = require('./routes/modules');
const assignmentRoutes = require('./routes/assignments');
const quizRoutes = require('./routes/quizzes');
const discussionRoutes = require('./routes/discussions');
const enrollmentRoutes = require('./routes/enrollments');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/upload');
const progressRoutes = require('./routes/progress');
const courseraRoutes = require('./routes/coursera');

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/courses', moduleRoutes);
app.use('/api/courses', assignmentRoutes);
app.use('/api/courses', quizRoutes);
app.use('/api/courses', discussionRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/coursera', courseraRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;