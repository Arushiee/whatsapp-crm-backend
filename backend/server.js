require('dotenv').config(); // Load environment variables from .env file

const http = require('http');
const app = require('./app');
// NEW
const { connectDB } = require('./config/db');
const socketHandler = require('./sockets/socketHandler');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Database
connectDB();

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO Handler
socketHandler.init(server);

// Start Server Listening
server.listen(PORT, () => {
  console.log(`============================================`);
  console.log(` WhatsApp CRM Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(` Listening on port: ${PORT}`);
  console.log(` Health check URL: http://localhost:${PORT}/health`);
  console.log(`============================================`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
