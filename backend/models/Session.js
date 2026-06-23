const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  contactId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  flowId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  currentNodeId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contextData: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
}, {
  timestamps: true,
  tableName: 'sessions',
});

module.exports = Session;