const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorHandler');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for Bearer token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('Authentication failed: No token provided.', 401)
      );
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production');

    // Find the user and verify they still exist
    const user = await User.findByPk(decoded.id, {
  attributes: { exclude: ['password'] }
});
    if (!user) {
      return next(
        new AppError('Authentication failed: User no longer exists.', 401)
      );
    }

    // Attach user information to request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = protect;
