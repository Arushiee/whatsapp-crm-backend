const express = require('express');
const cors = require('cors');
const { errorHandler, AppError } = require('./middleware/errorHandler');
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const messageRoutes = require('./routes/messageRoutes');
const agentRoutes = require('./routes/agentRoutes');
const leadStatusRoutes = require('./routes/leadStatusRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const templateRoutes = require('./routes/TemplatesRouter');
require('./utils/scheduler');

const app = express();

// ─── CORS Configuration ───────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`⚠️ CORS blocked request from: ${origin}`);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));

app.options('*', cors());

// ─── Global Middlewares ───────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/webhook', webhookRoutes);
app.use('/chatbot-flows', require('./routes/chatbotFlowRoutes'));
app.use('/templates', templateRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'WhatsApp CRM Backend is running smoothly',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'not set',
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/contacts', contactRoutes);
app.use('/messages', messageRoutes);
app.use('/agents', agentRoutes);
app.use('/lead-statuses', leadStatusRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/conversations', conversationRoutes);

// Catch-all for undefined endpoints
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find endpoint ${req.originalUrl} on this server`, 404));
});

// Centralized Global Error Handler
app.use(errorHandler);

module.exports = app;