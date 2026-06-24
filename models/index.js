const { sequelize } = require('../config/db');
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'agent'), defaultValue: 'agent' },
}, {
  timestamps: true, tableName: 'users',
  hooks: {
    beforeCreate: async (user) => { user.password = await bcrypt.hash(user.password, 10); },
    beforeUpdate: async (user) => { if (user.changed('password')) user.password = await bcrypt.hash(user.password, 10); },
  },
});
User.prototype.comparePassword = function(entered) { return bcrypt.compare(entered, this.password); };

const Contact = sequelize.define('Contact', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, defaultValue: '' },
  avatar: { type: DataTypes.STRING, defaultValue: '' },
  avatarBg: { type: DataTypes.STRING, defaultValue: 'bg-teal-500' },
  leadStatus: { type: DataTypes.ENUM('New','Contacted','Qualified','Proposal','Negotiation','Closed Won','Closed Lost'), defaultValue: 'New' },
  assignedAgent: { type: DataTypes.STRING, defaultValue: 'Unassigned' },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  followUpDate: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  lastMessage: { type: DataTypes.JSON, defaultValue: { text: '', senderType: '', timestamp: null } },
  unreadCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  windowStatus: { type: DataTypes.ENUM('active', 'closed', 'expired'), defaultValue: 'closed' },   // ← add
  windowExpiresAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },                   // ← add
}, { timestamps: true, tableName: 'contacts' });

const Conversation = sequelize.define('Conversation', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  contactId: { type: DataTypes.UUID, allowNull: false, unique: true },
  assignedAgent: { type: DataTypes.STRING, defaultValue: null },
  status: { type: DataTypes.ENUM('open','snoozed','closed'), defaultValue: 'open' },
}, { timestamps: true, tableName: 'conversations' });

const Message = sequelize.define('Message', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  conversationId: { type: DataTypes.UUID, allowNull: false },
  senderType: { type: DataTypes.ENUM('customer','agent','bot','system'), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  deliveryStatus: { type: DataTypes.ENUM('sent','delivered','read','failed'), defaultValue: 'sent' },
}, { timestamps: true, tableName: 'messages', indexes: [{ fields: ['conversationId','timestamp'] }] });

const Campaign = sequelize.define('Campaign', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('draft','scheduled','sending','completed','failed'), defaultValue: 'draft' },
  templateName: { type: DataTypes.STRING, defaultValue: '' },
  scheduledAt: { type: DataTypes.DATE, defaultValue: null },
}, { timestamps: true, tableName: 'campaigns' });

const CampaignRecipient = sequelize.define('CampaignRecipient', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  campaignId: { type: DataTypes.UUID, allowNull: false },
  contactId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM('pending','sent','delivered','read','failed'), defaultValue: 'pending' },
  errorMessage: { type: DataTypes.STRING, defaultValue: '' },
  sentAt: { type: DataTypes.DATE, defaultValue: null },
}, { timestamps: true, tableName: 'campaign_recipients', indexes: [{ unique: true, fields: ['campaignId','contactId'] }] });

// ✅ FIXED: Added triggerType field
const BotFlow = sequelize.define('BotFlow', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  triggerType: { type: DataTypes.STRING(50), defaultValue: 'first_time_user', allowNull: false },
  triggerKeywords: { type: DataTypes.JSON, defaultValue: [] },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: false },
  nodes: { type: DataTypes.JSON, defaultValue: [] },
  startNodeId: { type: DataTypes.STRING, allowNull: false },
}, { timestamps: true, tableName: 'bot_flows' });

const Session = sequelize.define('Session', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  contactId: { type: DataTypes.UUID, allowNull: false, unique: true },
  flowId: { type: DataTypes.UUID, allowNull: false },
  currentNodeId: { type: DataTypes.STRING, allowNull: false },
  contextData: { type: DataTypes.JSON, defaultValue: {} },
}, { timestamps: true, tableName: 'sessions' });

Contact.hasOne(Conversation, { foreignKey: 'contactId', onDelete: 'CASCADE' });
Conversation.belongsTo(Contact, { foreignKey: 'contactId' });
Conversation.hasMany(Message, { foreignKey: 'conversationId', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });
Campaign.hasMany(CampaignRecipient, { foreignKey: 'campaignId', onDelete: 'CASCADE' });
CampaignRecipient.belongsTo(Campaign, { foreignKey: 'campaignId' });
Contact.hasMany(CampaignRecipient, { foreignKey: 'contactId', onDelete: 'CASCADE' });
CampaignRecipient.belongsTo(Contact, { foreignKey: 'contactId' });

module.exports = { sequelize, User, Contact, Conversation, Message, Campaign, CampaignRecipient, BotFlow, Session };