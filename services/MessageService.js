const Message = require('../models/Message');
const { Contact } = require('../models');
const ConversationService = require('./ConversationService');
const { AppError } = require('../middleware/errorHandler');
const socketHandler = require('../sockets/socketHandler');

class MessageService {

  async saveMessage({ contactId, messageText, senderType }) {
    // 1. Find or create conversation for this contact
    const conversation = await ConversationService.findOrCreateConversation(contactId);

    // 2. Save message to DB
    const message = await Message.create({
      conversationId: conversation.id,
      senderType,
      message: messageText,
      timestamp: new Date(),
      deliveryStatus: 'sent',
    });

    // 3. Update contact's lastMessage and unreadCount
    const lastMsgUpdate = {
      text: messageText,
      senderType,
      timestamp: message.timestamp,
    };

    const contact = await Contact.findByPk(contactId);
    if (!contact) {
      throw new AppError('Contact not found while saving message', 404);
    }

    contact.lastMessage = lastMsgUpdate;
    if (senderType === 'customer') {
      contact.unreadCount = (contact.unreadCount || 0) + 1;
    } else {
      contact.unreadCount = 0;
    }
    await contact.save();

    // 4. Touch conversation updatedAt
    conversation.changed('updatedAt', true);
    await conversation.save();

    // 5. Build populated message payload for socket + response
    const populatedMessage = {
      _id: message.id,
      conversationId: message.conversationId,
      senderType: message.senderType,
      message: message.message,
      timestamp: message.timestamp,
      deliveryStatus: message.deliveryStatus,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        avatar: contact.avatar,
      },
    };

    // 6. Emit real-time WebSocket event
    socketHandler.emitNewMessage(populatedMessage);

    return populatedMessage;
  }

  async getMessagesByContactId(contactId) {
    const conversation = await ConversationService.findOrCreateConversation(contactId);
    return await Message.findAll({
      where: { conversationId: conversation.id },
      order: [['timestamp', 'ASC']],
    });
  }
}

module.exports = new MessageService();