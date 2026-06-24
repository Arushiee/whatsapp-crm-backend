const { Conversation } = require('../models');
const { AppError } = require('../middleware/errorHandler');

class ConversationService {

  async findOrCreateConversation(contactId) {
    let conversation = await Conversation.findOne({ where: { contactId } });
    if (!conversation) {
      conversation = await Conversation.create({
        contactId,
        assignedAgent: null,
        status: 'queued',
      });

      try {
        const socketHandler = require('../sockets/socketHandler');
        socketHandler.emitQueueUpdate({ contactId, conversationId: conversation.id, status: 'queued' });
      } catch (e) {
        console.warn('[ConversationService] Socket emit failed:', e.message);
      }
    }
    return conversation;
  }

  async getQueuedConversations() {
    const { Contact } = require('../models');
    return await Conversation.findAll({
      where: { status: 'queued' },
      include: [{ model: Contact }],
      order: [['createdAt', 'ASC']],
    });
  }

  async getAssignedConversations() {
    const { Contact } = require('../models');
    return await Conversation.findAll({
      where: { status: 'open' },
      include: [{ model: Contact }],
      order: [['updatedAt', 'DESC']],
    });
  }

  async assignAgent(conversationId, agentName) {
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) throw new AppError('Conversation not found', 404);

    conversation.assignedAgent = agentName;
    conversation.status = 'open';
    await conversation.save();

    try {
      const socketHandler = require('../sockets/socketHandler');
      socketHandler.emitConversationAssigned({
        conversationId,
        assignedAgent: agentName,
        status: 'open',
        contactId: conversation.contactId,
      });
    } catch (e) {
      console.warn('[ConversationService] Socket emit failed:', e.message);
    }

    // 🤖 Trigger bot flow for conversation_assigned
    try {
      const ChatbotEngine = require('./ChatbotEngine');
      await ChatbotEngine.triggerSystemFlow({
        triggerType: 'conversation_assigned',
        contactId: conversation.contactId,
        conversationId,
        payload: { agentId: agentName },
      });
    } catch (e) {
      console.warn('[ConversationService] ChatbotEngine trigger failed:', e.message);
    }

    return conversation;
  }

  async getConversationById(id) {
    const { Contact } = require('../models');
    const conversation = await Conversation.findByPk(id, {
      include: [{ model: Contact }],
    });
    if (!conversation) throw new AppError('Conversation not found', 404);
    return conversation;
  }

  async updateConversationStatus(conversationId, status) {
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) throw new AppError('Conversation not found', 404);

    const previousStatus = conversation.status;
    conversation.status = status;
    await conversation.save();

    // 🤖 Trigger bot flow when conversation is resolved
    if (status === 'resolved' && previousStatus !== 'resolved') {
      try {
        const ChatbotEngine = require('./ChatbotEngine');
        await ChatbotEngine.triggerSystemFlow({
          triggerType: 'conversation_resolved',
          contactId: conversation.contactId,
          conversationId,
        });
      } catch (e) {
        console.warn('[ConversationService] ChatbotEngine trigger failed:', e.message);
      }
    }

    return conversation;
  }

  async assignAgentToConversation(conversationId, agentId) {
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) throw new AppError('Conversation not found', 404);

    conversation.assignedAgent = agentId || null;
    await conversation.save();

    // 🤖 Trigger bot flow for conversation_assigned
    if (agentId) {
      try {
        const ChatbotEngine = require('./ChatbotEngine');
        await ChatbotEngine.triggerSystemFlow({
          triggerType: 'conversation_assigned',
          contactId: conversation.contactId,
          conversationId,
          payload: { agentId },
        });
      } catch (e) {
        console.warn('[ConversationService] ChatbotEngine trigger failed:', e.message);
      }
    }

    return conversation;
  }
}

module.exports = new ConversationService();