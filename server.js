require('dotenv').config();
const http = require('http');
const app = require('./app');
const { sequelize } = require('./models'); // ← Sequelize, not connectDB
const socketHandler = require('./sockets/socketHandler');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test MySQL connection
    await sequelize.authenticate();
    console.log('✅ MySQL connected successfully via Sequelize');

    // We use alter:false so no auto-migration, just verify connection
    // await sequelize.sync({ alter: false }); // optional, remove if models already exist

    const server = http.createServer(app);
    socketHandler.init(server);

    server.listen(PORT, () => {
      console.log(`============================================`);
      console.log(` WhatsApp CRM Server running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(` Listening on port: ${PORT}`);
      console.log(` Health check URL: http://localhost:${PORT}/health`);
      console.log(`============================================`);
    });

    server.on('unhandledRejection', (err) => {
      console.error(`Unhandled Rejection: ${err.message}`);
      server.close(() => process.exit(1));
    });

  } catch (err) {
    console.error('❌ Failed to connect to MySQL:', err.message);
    process.exit(1);
  }
}

startServer();