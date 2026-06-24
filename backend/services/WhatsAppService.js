/**
 * WhatsAppService.js
 *
 * Handles Meta WhatsApp Cloud API integration.
 * Sends text messages, interactive button messages, and templates.
 * Processes inbound webhooks and dispatches them through ChatbotEngine.
 */

const { Contact, Message } = require('../models');
const ConversationService  = require('./ConversationService');
const ChatbotEngine        = require('./ChatbotEngine');
const socketHandler        = require('../sockets/socketHandler');

class WhatsAppService {

  // ─── OUTBOUND ──────────────────────────────────────────────────────────

  /**
   * Send a plain text message to a WhatsApp number.
   * Replace the console.log body with your actual Meta API call when ready.
   */
  async sendWhatsAppMessage(toPhone, messageBody) {
    console.log(`[WhatsAppService] sendWhatsAppMessage to ${toPhone}: "${messageBody}"`);

    // TODO: replace with real Meta API call
    // const response = await axios.post(
    //   `https://graph.facebook.com/v18.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    //   { messaging_product: 'whatsapp', to: toPhone, type: 'text', text: { body: messageBody } },
    //   { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } }
    // );

    return {
      success:   true,
      messageId: `wamid.sim_${Math.floor(Math.random() * 100000)}`,
      status:    'accepted',
    };
  }

  /**
   * Send an interactive button message (used by interactive_reply nodes).
   * buttons: [{ id: 'btn_1', title: 'Option A' }, ...]  — max 3 for WhatsApp.
   */
  async sendInteractiveButtons(toPhone, bodyText, buttons) {
    console.log(`[WhatsAppService] sendInteractiveButtons to ${toPhone}: "${bodyText}"`, buttons);

    // TODO: replace with real Meta API call
    // const response = await axios.post(
    //   `https://graph.facebook.com/v18.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    //   {
    //     messaging_product: 'whatsapp',
    //     to: toPhone,
    //     type: 'interactive',
    //     interactive: {
    //       type: 'button',
    //       body: { text: bodyText },
    //       action: {
    //         buttons: buttons.map(b => ({
    //           type:  'reply',
    //           reply: { id: b.id, title: b.title },
    //         })),
    //       },
    //     },
    //   },
    //   { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } }
    // );

    return {
      success:   true,
      messageId: `wamid.sim_${Math.floor(Math.random() * 100000)}`,
      status:    'accepted',
    };
  }

  /**
   * Send a pre-approved template message.
   * Required when initiating a conversation outside the 24-hour window.
   */
  async sendTemplate(toPhone, templateName, languageCode = 'en_US', components = []) {
    console.log(`[WhatsAppService] sendTemplate "${templateName}" to ${toPhone} [${languageCode}]`);

    // TODO: replace with real Meta API call
    // const response = await axios.post(
    //   `https://graph.facebook.com/v18.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    //   {
    //     messaging_product: 'whatsapp',
    //     to: toPhone,
    //     type: 'template',
    //     template: { name: templateName, language: { code: languageCode }, components },
    //   },
    //   { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` } }
    // );

    return {
      success:      true,
      templateName,
      messageId:    `wamid.sim_${Math.floor(Math.random() * 100000)}`,
      status:       'accepted',
    };
  }

  // ─── INBOUND ───────────────────────────────────────────────────────────

  /**
   * Process an inbound WhatsApp webhook payload from Meta.
   * Parses the message, saves it to the DB, emits via socket,
   * and runs it through ChatbotEngine.
   *
   * Call this from your webhook verification + receive route.
   */
  async receiveWebhook(webhookData) {
    console.log('[WhatsAppService] receiveWebhook payload:', JSON.stringify(webhookData, null, 2));

    try {
      const entry   = webhookData.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;

      if (!value) return { processed: false, reason: 'empty payload' };

      // Handle delivery/read receipts — no action needed
      if (value.statuses) {
        console.log('[WhatsAppService] Delivery status update received');
        return { processed: true, type: 'status_update' };
      }

      const inboundMessage = value.messages?.[0];
      const contactMeta    = value.contacts?.[0];

      if (!inboundMessage || !contactMeta) {
        return { processed: false, reason: 'no message found in payload' };
      }

      const phone       = inboundMessage.from;
      const waMessageId = inboundMessage.id;
      const name        = contactMeta.profile?.name || phone;

      // Determine message type and extract content
      let messageText  = '';
      let triggerType  = 'inbound_message';
      let buttonId     = null;

      if (inboundMessage.type === 'text') {
        messageText = inboundMessage.text?.body || '';
        triggerType = 'inbound_message';

      } else if (inboundMessage.type === 'interactive') {
        const interactive = inboundMessage.interactive;

        if (interactive?.type === 'button_reply') {
          // Customer tapped a quick-reply button
          buttonId    = interactive.button_reply?.id    || null;
          messageText = interactive.button_reply?.title || '';
          triggerType = 'interactivemessage';

        } else if (interactive?.type === 'list_reply') {
          // Customer selected from a list
          buttonId    = interactive.list_reply?.id    || null;
          messageText = interactive.list_reply?.title || '';
          triggerType = 'interactivemessage';
        }

      } else {
        // Unsupported type (image, audio, video, document, location, etc.)
        console.log(`[WhatsAppService] Unsupported message type: ${inboundMessage.type}`);
        return { processed: false, reason: `unsupported type: ${inboundMessage.type}` };
      }

      if (!messageText && !buttonId) {
        return { processed: false, reason: 'no usable content in message' };
      }

      // 1. Find or create contact
      let contact = await Contact.findOne({ where: { phone } });
      if (!contact) {
        contact = await Contact.create({
          name,
          phone,
          email:         '',
          avatar:        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          avatarBg:      'bg-teal-500',
          leadStatus:    'New',
          assignedAgent: 'Unassigned',
          tags:          [],
          notes:         '',
          lastMessage:   { text: messageText, senderType: 'customer', timestamp: new Date() },
          unreadCount:   1,
        });
      } else {
        await contact.update({
          lastMessage: { text: messageText, senderType: 'customer', timestamp: new Date() },
          unreadCount: (contact.unreadCount || 0) + 1,
        });
      }

      // 2. Find or create conversation
      const conversation = await ConversationService.findOrCreateConversation(contact.id);

      // 3. Save inbound message to DB
      const savedMessage = await Message.create({
        conversationId: conversation.id,
        senderType:     'customer',
        message:        messageText,
        meta:           { waMessageId, type: inboundMessage.type, buttonId },
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
        console.warn('[WhatsAppService] Socket emit failed:', e.message);
      }

      // 5. 🤖 Run through chatbot engine
      await ChatbotEngine.processMessage({
        contactId:      contact.id,
        conversationId: conversation.id,
        messageText,
        triggerType,
        buttonId,
      });

      return { processed: true, receivedAt: new Date(), type: triggerType };

    } catch (err) {
      console.error('[WhatsAppService] receiveWebhook error:', err);
      return { processed: false, error: err.message };
    }
  }
}

module.exports = new WhatsAppService();