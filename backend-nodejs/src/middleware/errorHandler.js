const logger = require('../utils/logger');

class ErrorHandler {
  static handle(err, req, res, next) {
    logger.error(`Error: ${err.message}`, { 
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        detail: errors.join(', ') 
      });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({ 
        detail: `${field} already exists` 
      });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        detail: 'Invalid token' 
      });
    }

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        detail: 'Token expired' 
      });
    }

    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
      return res.status(400).json({ 
        detail: 'Invalid ID format' 
      });
    }

    // Default error response
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
      detail: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Async error wrapper
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Create custom error
  static createError(message, statusCode = 500) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  }

  // 404 handler
  static notFound(req, res, next) {
    const error = ErrorHandler.createError(`Not found - ${req.originalUrl}`, 404);
    next(error);
  }
}

module.exports = ErrorHandler;