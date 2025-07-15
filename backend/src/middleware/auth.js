const User = require('../models/User');
const Helpers = require('../utils/helpers');
const { USER_ROLES } = require('../config/constants');
const logger = require('../utils/logger');

class AuthMiddleware {
  // Verify JWT token and get current user
  static async authenticate(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ 
          detail: 'Access denied. No token provided.' 
        });
      }

      const decoded = Helpers.verifyToken(token);
      const user = await User.findOne({ email: decoded.sub });
      
      if (!user) {
        return res.status(401).json({ 
          detail: 'Could not validate credentials' 
        });
      }

      if (!user.is_active) {
        return res.status(401).json({ 
          detail: 'Account is deactivated' 
        });
      }

      req.user = user;
      next();
    } catch (error) {
      logger.error(`Authentication error: ${error.message}`);
      res.status(401).json({ 
        detail: 'Could not validate credentials' 
      });
    }
  }

  // Require specific role
  static requireRole(role) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ 
          detail: 'Authentication required' 
        });
      }

      if (req.user.role !== role) {
        return res.status(403).json({ 
          detail: 'Not enough permissions' 
        });
      }

      next();
    };
  }

  // Require any of the specified roles
  static requireAnyRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ 
          detail: 'Authentication required' 
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ 
          detail: 'Not enough permissions' 
        });
      }

      next();
    };
  }

  // Require admin role
  static requireAdmin() {
    return AuthMiddleware.requireRole(USER_ROLES.ADMIN);
  }

  // Require instructor role
  static requireInstructor() {
    return AuthMiddleware.requireRole(USER_ROLES.INSTRUCTOR);
  }

  // Require student role
  static requireStudent() {
    return AuthMiddleware.requireRole(USER_ROLES.STUDENT);
  }

  // Require instructor or admin role
  static requireInstructorOrAdmin() {
    return AuthMiddleware.requireAnyRole([USER_ROLES.INSTRUCTOR, USER_ROLES.ADMIN]);
  }

  // Optional authentication (user may or may not be logged in)
  static async optionalAuth(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (token) {
        const decoded = Helpers.verifyToken(token);
        const user = await User.findOne({ email: decoded.sub });
        
        if (user && user.is_active) {
          req.user = user;
        }
      }
      
      next();
    } catch (error) {
      // If token is invalid, continue without user
      next();
    }
  }
}

module.exports = AuthMiddleware;