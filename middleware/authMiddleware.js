const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorHandler');

const protect = async (req, res, next) => {
  try {
    // ── 1. Extract token ──────────────────────────────────────────────────────
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Authentication failed: No token provided.', 401));
    }

    // ── 2. Guard: JWT_SECRET must be set ──────────────────────────────────────
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is not set in environment variables!');
      return next(new AppError('Server configuration error: JWT_SECRET missing.', 500));
    }

    // ── 3. Verify token ───────────────────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError.message);
      return next(new AppError('Authentication failed: Invalid or expired token.', 401));
    }

    // ── 4. Check user still exists ────────────────────────────────────────────
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      return next(new AppError('Authentication failed: User no longer exists.', 401));
    }

    // ── 5. Attach user to request ─────────────────────────────────────────────
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = protect;