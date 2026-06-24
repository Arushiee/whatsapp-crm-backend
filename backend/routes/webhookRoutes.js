/**
 * webhookRoutes.js
 * Handles inbound messages and external webhook events.
 * Runs all traffic through ChatbotEngine.
 */
const express = require('express');
const router  = express.Router();
const { Contact, Message, Conversation } = require('../models');
const ConversationService = require('../services/ConversationService');
const ChatbotEngine       = require('../services/ChatbotEngine');
const socketHandler       = require('../sockets/socketHandler');

const WINDOW_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

// ─── POST /webhook/simulate ───────────────────────────────────────────────
router.post('/simulate', async (req, res) => {
  try {
    const { name, phone, message, triggerType, buttonId } = req.body;
    if (!name || !phone || !message) {
      return res.status(400).json({
        status:  'fail',
        message: 'name, phone, and message are required',
      });
    }

    const windowExpiresAt = new Date(Date.now() + WINDOW_DURATION);

    // 1. Find or create contact
    let contact = await Contact.findOne({ where: { phone } });
    if (!contact) {
      contact = await Contact.create({
        name,
        phone,
        email:           '',
        avatar:          name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        avatarBg:        'bg-teal-500',
        leadStatus:      'New',
        assignedAgent:   'Unassigned',
        tags:            [],
        notes:           '',
        lastMessage:     { text: message, senderType: 'customer', timestamp: new Date() },
        unreadCount:     1,
        windowStatus:    'active',       // ← new
        windowExpiresAt,                 // ← new
      });
    } else {
      await contact.update({
        lastMessage:     { text: message, senderType: 'customer', timestamp: new Date() },
        unreadCount:     (contact.unreadCount || 0) + 1,
        windowStatus:    'active',       // ← new
        windowExpiresAt,                 // ← new
      });
    }

    // 2. Find or create conversation
    const conversation = await ConversationService.findOrCreateConversation(contact.id);

    // 3. Save the inbound customer message
    const savedMessage = await Message.create({
      conversationId: conversation.id,
      senderType:     'customer',
      message,
      timestamp:      new Date(),
      deliveryStatus: 'delivered',
    });

    // 4. Emit to dashboard via socket.io
    try {
      socketHandler.emitNewMessage({
        conversationId: conversation.id,
        contactId:      contact.id,
        message:        savedMessage,
      });
    } catch (e) {
      console.warn('[Webhook] Socket emit failed:', e.message);
    }

    // 5. 🤖 Run through chatbot engine
    await ChatbotEngine.processMessage({
      contactId:      contact.id,
      conversationId: conversation.id,
      messageText:    message,
      triggerType:    triggerType || 'inbound_message',
      buttonId:       buttonId   || null,
    });

    res.status(200).json({
      status:  'success',
      message: 'Message received and processed',
      data:    { contact, conversation, message: savedMessage },
    });
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── POST /webhook/external ───────────────────────────────────────────────
router.post('/external', async (req, res) => {
  try {
    const { contactId, conversationId, event, ...extraPayload } = req.body;
    if (!contactId || !conversationId || !event) {
      return res.status(400).json({
        status:  'fail',
        message: 'contactId, conversationId, and event are required',
      });
    }

    await ChatbotEngine.triggerSystemFlow({
      triggerType:    'webhook',
      contactId,
      conversationId,
      payload:        { event, ...extraPayload },
    });

    res.status(200).json({
      status:  'success',
      message: `Webhook event "${event}" processed`,
    });
  } catch (err) {
    console.error('[Webhook] External event error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── POST /webhook/resolve ────────────────────────────────────────────────
router.post('/resolve', async (req, res) => {
  try {
    const { contactId, conversationId } = req.body;
    if (!contactId || !conversationId) {
      return res.status(400).json({
        status:  'fail',
        message: 'contactId and conversationId are required',
      });
    }

    // Close the window when conversation is resolved
    await Contact.update(
      { windowStatus: 'closed', windowExpiresAt: null },
      { where: { id: contactId } }
    );

    await ConversationService.updateConversationStatus(conversationId, 'resolved');

    res.status(200).json({
      status:  'success',
      message: 'Conversation resolved',
    });
  } catch (err) {
    console.error('[Webhook] Resolve error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;