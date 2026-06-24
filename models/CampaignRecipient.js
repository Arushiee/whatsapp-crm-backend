const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CampaignRecipient = sequelize.define('CampaignRecipient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  campaignId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  contactId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read', 'failed'),
    defaultValue: 'pending',
  },
  errorMessage: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  sentAt: {
    type: DataTypes.DATE,
    defaultValue: null,
  },
}, {
  timestamps: true,
  tableName: 'campaign_recipients',
  indexes: [
    {
      unique: true,
      fields: ['campaignId', 'contactId'],
    },
  ],
});

module.exports = CampaignRecipient;