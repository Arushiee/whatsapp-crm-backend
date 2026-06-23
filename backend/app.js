const express = require('express');
const cors = require('cors');
const { errorHandler, AppError } = require('./middleware/errorHandler');
const webhookRoutes = require('./routes/webhookRoutes');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const messageRoutes = require('./routes/messageRoutes');
const agentRoutes = require('./routes/agentRoutes');
const leadStatusRoutes = require('./routes/leadStatusRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const conversationRoutes = require('./routes/conversationRoutes'); // NEW
const templateRoutes = require('./routes/TemplatesRouter')
require('./utils/scheduler');

const app = express();

// Global Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/webhook', webhookRoutes);
app.use('/chatbot-flows', require('./routes/chatbotFlowRoutes'));
app.use('/templates', templateRoutes); 

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'WhatsApp CRM Backend is running smoothly',
    timestamp: new Date()
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/contacts', contactRoutes);
app.use('/messages', messageRoutes);
app.use('/agents', agentRoutes);
app.use('/lead-statuses', leadStatusRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/conversations', conversationRoutes); // NEW

// Catch-all route for undefined endpoints
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find endpoint ${req.originalUrl} on this server`, 404));
});

// Centralized Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;







