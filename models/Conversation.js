const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Conversation = sequelize.define('Conversation', {
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
  assignedAgent: {
    type: DataTypes.STRING,
    defaultValue: null,
  },
  status: {
    type: DataTypes.ENUM('queued', 'open', 'snoozed', 'closed'), // added 'queued'
    defaultValue: 'queued', // new conversations start in queue
  },
}, {
  timestamps: true,
  tableName: 'conversations',
});

module.exports = Conversation;