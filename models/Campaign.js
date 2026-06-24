const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Campaign = sequelize.define('Campaign', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'completed', 'failed'),
    defaultValue: 'draft',
  },
  templateName: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  scheduledAt: {
    type: DataTypes.DATE,
    defaultValue: null,
  },
}, {
  timestamps: true,
  tableName: 'campaigns',
});

module.exports = Campaign;