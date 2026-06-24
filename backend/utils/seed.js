require('dotenv').config();
const { connectDB } = require('../config/db');
const { User, sequelize } = require('../models');

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding...');
  const [, created] = await User.findOrCreate({
    where: { email: 'admin@crm.com' },
    defaults: { name: 'Admin', email: 'admin@crm.com', password: 'admin123', role: 'admin' },
  });
  console.log(created ? '✅ Admin created' : 'ℹ️  Admin already exists');
  console.log('   Email:    admin@crm.com');
  console.log('   Password: admin123');
  await sequelize.close();
  process.exit(0);
};

seed().catch((err) => { console.error('❌ Seed failed:', err.message); process.exit(1); });
