const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { AppError } = require('../middleware/errorHandler');

// Helper to sign JWTs
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production',
    { expiresIn: '30d' }
  );
};

class AuthController {
  /**
   * Register a new user (admin or agent)
   */
  async register(req, res, next) {
    try {
      const { name, email, password, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return next(new AppError('A user with this email address already exists.', 400));
      }

      // Create new user (password is automatically hashed via Sequelize hook)
      const user = await User.create({
        name,
        email,
        password,
        role: role || 'agent'
      });

      // Generate JWT token with Sequelize user.id
      const token = generateToken(user.id);

      res.status(201).json({
        status: 'success',
        token,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log in user
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(new AppError('Invalid email or password.', 401));
      }

      // Verify password
      const isPasswordCorrect = await user.comparePassword(password);
      if (!isPasswordCorrect) {
        return next(new AppError('Invalid email or password.', 401));
      }

      // Generate token with Sequelize user.id
      const token = generateToken(user.id);

      res.status(200).json({
        status: 'success',
        token,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();