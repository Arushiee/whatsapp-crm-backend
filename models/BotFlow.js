const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BotFlow = sequelize.define('BotFlow', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  triggerType: {
    type: DataTypes.STRING(50),
    defaultValue: 'first_time_user',
    allowNull: false,
  },
  triggerKeywords: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  triggerButtonIds: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  catchAll: {                        // ← ADD THIS
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'catch_all',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  nodes: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  startNodeId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'bot_flows',
});

module.exports = BotFlow;