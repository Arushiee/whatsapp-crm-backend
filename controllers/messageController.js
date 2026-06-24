const MessageService = require('../services/MessageService');
const socketHandler = require('../sockets/socketHandler');

class MessageController {
  /**
   * Get all messages for a specific contact's conversation session
   * GET /messages/:contactId
   */
  async getMessagesByContactId(req, res, next) {
    try {
      const messages = await MessageService.getMessagesByContactId(req.params.contactId);
      res.status(200).json({
        status: 'success',
        results: messages.length,
        data: { messages }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send/Save a message
   * POST /messages
   */
  async sendMessage(req, res, next) {
    try {
      const { contactId, message, senderType } = req.body;

      // Save message to DB via service
      const newMessage = await MessageService.saveMessage({
        contactId,
        messageText: message,
        senderType: senderType || 'agent'
      });

      // ✅ Emit real-time event to all connected clients
      socketHandler.emitNewMessage({
        ...newMessage.toObject?.() ?? newMessage,
        conversationId: contactId,
      });

      res.status(201).json({
        status: 'success',
        data: { message: newMessage }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MessageController();