const { body, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');

// Middleware to collect validation errors and forward to error handler
const validateResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array().map(err => `${err.msg}`).join(', ');
    return next(new AppError(errorMsg, 400));
  }
  next();
};

const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['admin', 'agent'])
    .withMessage('Role must be either admin or agent'),
  validateResult
];

const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validateResult
];

const createContactValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Contact name is required'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number (e.g. +1234567890)'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  validateResult
];

const updateContactValidator = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Contact name cannot be empty'),
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please provide a valid phone number (e.g. +1234567890)'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('leadStatus')
    .optional()
    .isIn(['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'])
    .withMessage('Invalid leadStatus value'),
  body('assignedAgent')
    .optional({ nullable: true })
    .custom((value) => {
      // Allow null, empty string, or any non-empty string (agent name)
      return true;
    }),
  body('notes')
    .optional()
    .trim(),
  body('tags')
    .optional()
    .isArray()
    .withMessage('tags must be an array of strings'),
  body('followUpDate')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === '' || value === null) return true;
      if (isNaN(Date.parse(value))) {
        throw new Error('followUpDate must be a valid date');
      }
      return true;
    }),
  validateResult
];

const sendMessageValidator = [
  // After
body('contactId')
    .trim()
    .notEmpty()
    .withMessage('contactId is required')
    .isUUID()
    .withMessage('contactId must be a valid UUID'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('message body is required'),
  body('senderType')
    .optional()
    .isIn(['customer', 'agent', 'bot', 'system'])
    .withMessage('senderType must be one of: customer, agent, bot, system'),
  validateResult
];

module.exports = {
  registerValidator,
  loginValidator,
  createContactValidator,
  updateContactValidator,
  sendMessageValidator,
};
