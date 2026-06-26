const { Op } = require('sequelize');
const { Contact } = require('../models');
const Conversation = require('../models/Conversation');
const { AppError } = require('../middleware/errorHandler');

class ContactService {

  async getAllContacts(query = {}) {
    const where = {};
    if (query.leadStatus)    where.leadStatus    = query.leadStatus;
    if (query.assignedAgent) where.assignedAgent = query.assignedAgent;
    if (query.tag)           where.tags          = { [Op.like]: `%${query.tag}%` };

    const contacts = await Contact.findAll({ where, order: [['updatedAt', 'DESC']] });
    const contactIds = contacts.map(c => c.id);
    const conversations = await Conversation.findAll({ where: { contactId: contactIds } });

    const convMap = {};
    conversations.forEach(cv => { convMap[cv.contactId] = cv; });

    return contacts.map(c => {
      const plain = c.toJSON();
      const conv  = convMap[c.id];
      if (conv) {
        plain.assignedAgent      = conv.assignedAgent || 'Unassigned';
        plain.conversationStatus = conv.status;
        plain.conversationId     = conv.id;
      }
      return plain;
    });
  }

  async getContactById(id) {
    const contact = await Contact.findByPk(id);
    if (!contact) throw new AppError('Contact not found', 404);

    const conv  = await Conversation.findOne({ where: { contactId: id } });
    const plain = contact.toJSON();
    if (conv) {
      plain.assignedAgent      = conv.assignedAgent || 'Unassigned';
      plain.conversationStatus = conv.status;
      plain.conversationId     = conv.id;
    }
    return plain;
  }

  async createContact(contactData) {
    const existing = await Contact.findOne({ where: { phone: contactData.phone } });
    if (existing) throw new AppError('Contact with this phone number already exists', 400);
    return await Contact.create(contactData);
  }

  async updateContact(id, updateData) {
    const contact = await Contact.findByPk(id);
    if (!contact) throw new AppError('Contact not found to update', 404);

    await contact.update(updateData);

    if (updateData.assignedAgent !== undefined) {
      const conversation = await Conversation.findOne({ where: { contactId: id } });
      if (conversation) {
        const newAgent  = updateData.assignedAgent || null;
        const newStatus = newAgent && newAgent !== 'Unassigned'
          ? 'open'
          : conversation.status === 'open' ? 'queued' : conversation.status;

        await conversation.update({ assignedAgent: newAgent, status: newStatus });
        await contact.update({ assignedAgent: newAgent || 'Unassigned' });

        try {
          const socketHandler = require('../sockets/socketHandler');
          if (newAgent && newAgent !== 'Unassigned') {
            socketHandler.emitConversationAssigned({
              conversationId: conversation.id,
              assignedAgent:  newAgent,
              status:         'open',
              contactId:      id,
            });
          } else {
            socketHandler.emitQueueUpdate({
              contactId:      id,
              conversationId: conversation.id,
              status:         'queued',
            });
          }
        } catch (e) {
          console.warn('[ContactService] Socket emit failed:', e.message);
        }

        // 🤖 Trigger bot flow for conversation_assigned when agent is set
        if (newAgent && newAgent !== 'Unassigned') {
          try {
            const ChatbotEngine = require('./ChatbotEngine');
            await ChatbotEngine.triggerSystemFlow({
              triggerType:    'conversation_assigned',
              contactId:      id,
              conversationId: conversation.id,
              payload:        { agentId: newAgent },
            });
          } catch (e) {
            console.warn('[ContactService] ChatbotEngine trigger failed:', e.message);
          }
        }
      }
    }

    // 🤖 Trigger bot flow when a tag is added
    if (updateData.tags !== undefined) {
      const previousTags = (contact.tags || []);
      const newTags      = Array.isArray(updateData.tags) ? updateData.tags : [];
      const addedTags    = newTags.filter(t => !previousTags.includes(t));

      if (addedTags.length > 0) {
        const conversation = await Conversation.findOne({ where: { contactId: id } });
        if (conversation) {
          for (const tag of addedTags) {
            try {
              const ChatbotEngine = require('./ChatbotEngine');
              await ChatbotEngine.triggerSystemFlow({
                triggerType:    'contact_tag_added',
                contactId:      id,
                conversationId: conversation.id,
                payload:        { tag },
              });
            } catch (e) {
              console.warn('[ContactService] ChatbotEngine tag trigger failed:', e.message);
            }
          }
        }
      }
    }

    return await this.getContactById(id);
  }

  async deleteContact(id) {
    const contact = await Contact.findByPk(id);
    if (!contact) throw new AppError('Contact not found to delete', 404);
    await contact.destroy();
    return contact;
  }

  async markAsRead(id) {
    const contact = await Contact.findByPk(id);
    if (!contact) throw new AppError('Contact not found', 404);
    contact.unreadCount = 0;
    await contact.save();
    return contact;
  }
  async markAsUnread(id) {
  const contact = await Contact.findByPk(id);
  if (!contact) throw new AppError('Contact not found', 404);
  contact.unreadCount = 1;
  await contact.save();
  return contact;
}
}

module.exports = new ContactService();