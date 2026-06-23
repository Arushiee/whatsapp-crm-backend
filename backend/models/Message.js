const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  conversationId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  senderType: {
    type: DataTypes.ENUM('customer', 'agent', 'bot', 'system'),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  deliveryStatus: {
    type: DataTypes.ENUM('sent', 'delivered', 'read', 'failed'),
    defaultValue: 'sent',
  },
}, {
  timestamps: true,
  tableName: 'messages',
  indexes: [
    {
      fields: ['conversationId', 'timestamp'],
    },
  ],
});

module.exports = Message;