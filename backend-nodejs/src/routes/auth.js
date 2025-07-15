const express = require('express');
const User = require('../models/User');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const ErrorHandler = require('../middleware/errorHandler');
const Helpers = require('../utils/helpers');
const logger = require('../utils/logger');

const router = express.Router();

// Register new user
router.post('/register', 
  ValidationMiddleware.validateUserRegistration(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { email, password, full_name, role } = req.validatedData;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        detail: 'Email already registered' 
      });
    }

    // Hash password
    const hashedPassword = await Helpers.hashPassword(password);

    // Create new user
    const newUser = new User({
      email,
      full_name,
      role,
      hashed_password: hashedPassword
    });

    await newUser.save();

    logger.info(`New user registered: ${email} with role: ${role}`);

    // Return user without password
    res.status(201).json(newUser.getSafeUser());
  })
);

// Login user
router.post('/login',
  ValidationMiddleware.validateUserLogin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { email, password } = req.validatedData;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        detail: 'Incorrect email or password' 
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ 
        detail: 'Account is deactivated' 
      });
    }

    // Verify password
    const isPasswordValid = await Helpers.comparePassword(password, user.hashed_password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        detail: 'Incorrect email or password' 
      });
    }

    // Generate JWT token
    const token = Helpers.generateToken({ sub: user.email });

    logger.info(`User logged in: ${email}`);

    // Return token and user info
    res.json({
      access_token: token,
      token_type: 'bearer',
      user: user.getSafeUser()
    });
  })
);

// Get current user info
router.get('/me',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    res.json(req.user.getSafeUser());
  })
);

// Update user profile
router.put('/profile',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const { full_name } = req.body;
    const user = req.user;

    if (full_name) {
      user.full_name = full_name;
      await user.save();
    }

    res.json(user.getSafeUser());
  })
);

// Change password
router.put('/change-password',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body;
    const user = req.user;

    // Validate input
    if (!current_password || !new_password) {
      return res.status(400).json({ 
        detail: 'Current password and new password are required' 
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ 
        detail: 'New password must be at least 6 characters long' 
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await Helpers.comparePassword(current_password, user.hashed_password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        detail: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedNewPassword = await Helpers.hashPassword(new_password);
    user.hashed_password = hashedNewPassword;
    await user.save();

    logger.info(`Password changed for user: ${user.email}`);

    res.json({ 
      message: 'Password changed successfully' 
    });
  })
);

// Deactivate account
router.put('/deactivate',
  AuthMiddleware.authenticate,
  ErrorHandler.asyncHandler(async (req, res) => {
    const user = req.user;
    user.is_active = false;
    await user.save();

    logger.info(`Account deactivated for user: ${user.email}`);

    res.json({ 
      message: 'Account deactivated successfully' 
    });
  })
);

// Admin routes - Get all users
router.get('/users',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, role } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (role) {
      filter.role = role;
    }

    const users = await User.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ created_at: -1 });

    const total = await User.countDocuments(filter);

    const safeUsers = users.map(user => user.getSafeUser());

    res.json(Helpers.createPaginatedResponse(safeUsers, parseInt(page), parseInt(limit), total));
  })
);

// Admin routes - Update user
router.put('/users/:user_id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin(),
  ErrorHandler.asyncHandler(async (req, res) => {
    const { user_id } = req.params;
    const { full_name, role, is_active } = req.body;

    const user = await User.findOne({ id: user_id });
    if (!user) {
      return res.status(404).json({ 
        detail: 'User not found' 
      });
    }

    if (full_name) user.full_name = full_name;
    if (role) user.role = role;
    if (typeof is_active === 'boolean') user.is_active = is_active;

    await user.save();

    logger.info(`User updated by admin: ${user.email}`);

    res.json(user.getSafeUser());
  })
);

module.exports = router;