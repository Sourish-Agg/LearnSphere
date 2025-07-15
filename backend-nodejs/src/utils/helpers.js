const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');

class Helpers {
  // Generate UUID
  static generateId() {
    return uuidv4();
  }

  // Hash password
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // Compare password
  static async comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Generate JWT token
  static generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  // Verify JWT token
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

  // Remove sensitive fields from user object
  static sanitizeUser(user) {
    const { password, hashed_password, ...sanitizedUser } = user.toObject ? user.toObject() : user;
    return sanitizedUser;
  }

  // Calculate quiz score
  static calculateQuizScore(questions, answers) {
    let score = 0;
    const maxScore = questions.length;

    for (let i = 0; i < questions.length; i++) {
      if (i < answers.length) {
        const studentAnswer = answers[i];
        const correctAnswer = questions[i].correct_answer;
        if (studentAnswer.answer === correctAnswer) {
          score += 1;
        }
      }
    }

    return { score, maxScore };
  }

  // Format date for consistent output
  static formatDate(date) {
    return date ? new Date(date).toISOString() : null;
  }

  // Clean MongoDB document (remove _id, __v)
  static cleanDocument(doc) {
    if (!doc) return null;
    
    const cleaned = doc.toObject ? doc.toObject() : doc;
    delete cleaned._id;
    delete cleaned.__v;
    return cleaned;
  }

  // Clean array of MongoDB documents
  static cleanDocuments(docs) {
    return docs.map(doc => this.cleanDocument(doc));
  }

  // Validate email format
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate UUID format
  static isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Create paginated response
  static createPaginatedResponse(data, page, limit, total) {
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  // Create success response
  static createSuccessResponse(data, message = 'Success') {
    return {
      success: true,
      message,
      data
    };
  }

  // Create error response
  static createErrorResponse(message, code = 400) {
    return {
      success: false,
      message,
      code
    };
  }
}

module.exports = Helpers;