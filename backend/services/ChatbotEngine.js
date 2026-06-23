/**
 * ChatbotEngine.js
 * Processes inbound messages and system events through active bot flows.
 *
 * ── Customer-driven triggers (via processMessage) ─────────────────────────
 *   'keyword_match'      — fires if message text contains one of triggerKeywords
 *   'interactivemessage' — fires when customer taps a WhatsApp button (no active session)
 *   'first_time_user'    — fires only if contact has never received a bot message
 *   'inbound_message'    — fires on any regular text message
 *   'any_message'        — true catch-all
 *
 * ── System-driven triggers (via triggerSystemFlow) ────────────────────────
 *   'conversation_assigned'  — agent assigned to conversation
 *   'conversation_resolved'  — conversation closed/resolved
 *   'contact_tag_added'      — tag applied to contact
 *   'scheduled'              — cron/time-based (scheduler calls triggerSystemFlow)
 *   'webhook'                — external API/webhook event
 *
 * ── Node types ────────────────────────────────────────────────────────────
 *   'message'           — sends text; waitForReply=true pauses for customer reply
 *   'interactive_reply' — sends WhatsApp button list; waits for button tap
 *   'collect_input'     — waits for plain text reply and saves it to contextData
 *   'end'               — sends optional closing message and destroys session
 *
 * ── Customer trigger priority (most specific → least specific) ────────────
 *   1. keyword_match
 *   2. interactivemessage
 *   3. first_time_user
 *   4. inbound_message
 *   5. any_message
 *
 * ── interactivemessage flow matching rules ────────────────────────────────
 *   - Flow has triggerButtonIds set   → only fires when one of those IDs is tapped
 *   - Flow has catchAll: true         → fires only if no specific flow matched first
 *   - Flow has neither               → skipped (misconfigured — check your DB)
 */

const { BotFlow, Session, Contact, Message, Conversation } = require('../models');
const socketHandler = require('../sockets/socketHandler');

const CUSTOMER_TRIGGER_PRIORITY = [
  'keyword_match',
  'interactivemessage',
  'first_time_user',
  'inbound_message',
  'any_message',
];

const SYSTEM_TRIGGERS = new Set([
  'conversation_assigned',
  'conversation_resolved',
  'contact_tag_added',
  'scheduled',
  'webhook',
]);

// These system triggers override an active session
const HIGH_PRIORITY_SYSTEM_TRIGGERS = new Set([
  'conversation_resolved',
  'conversation_assigned',
]);

class ChatbotEngine {

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER MESSAGE ENTRY POINT
  // Call this after every inbound customer message.
  // ─────────────────────────────────────────────────────────────────────────

  async processMessage({
    contactId,
    conversationId,
    messageText,
    triggerType = 'inbound_message',
    buttonId    = null,
  }) {
    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) return;

      const activeSession = await Session.findOne({ where: { contactId } });

      if (activeSession) {
        // Button taps always belong to the current flow — never interrupt them
        if (triggerType !== 'interactivemessage') {
          const interruptFlow = await this.findInterruptingFlow(activeSession, messageText);
          if (interruptFlow) {
            console.log(`[ChatbotEngine] Interrupting flow ${activeSession.flowId} with "${interruptFlow.name}"`);
            await activeSession.destroy();
            return await this.startFlow(interruptFlow, contact, conversationId);
          }
        }
        return await this.resumeFlow(activeSession, messageText, contact, conversationId, buttonId);
      }

      // No active session — find a matching flow to start
      const flow = await this.findMatchingFlow(contact, messageText, triggerType, buttonId);
      if (flow) return await this.startFlow(flow, contact, conversationId);

    } catch (err) {
      console.error('[ChatbotEngine] processMessage error:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYSTEM EVENT ENTRY POINT
  // Call this from your service/hook layer — never from processMessage.
  //
  // Examples:
  //   ChatbotEngine.triggerSystemFlow({ triggerType: 'conversation_assigned', contactId, conversationId, payload: { agentId } })
  //   ChatbotEngine.triggerSystemFlow({ triggerType: 'conversation_resolved', contactId, conversationId })
  //   ChatbotEngine.triggerSystemFlow({ triggerType: 'contact_tag_added',     contactId, conversationId, payload: { tag: 'vip' } })
  //   ChatbotEngine.triggerSystemFlow({ triggerType: 'webhook',               contactId, conversationId, payload: { event: 'payment_failed' } })
  //   ChatbotEngine.triggerSystemFlow({ triggerType: 'scheduled',             contactId, conversationId })
  // ─────────────────────────────────────────────────────────────────────────

  async triggerSystemFlow({ triggerType, contactId, conversationId, payload = {} }) {
    if (!SYSTEM_TRIGGERS.has(triggerType)) {
      console.warn(`[ChatbotEngine] "${triggerType}" is not a recognised system trigger`);
      return;
    }

    try {
      const contact = await Contact.findByPk(contactId);
      if (!contact) return;

      const activeSession = await Session.findOne({ where: { contactId } });

      if (activeSession) {
        if (HIGH_PRIORITY_SYSTEM_TRIGGERS.has(triggerType)) {
          console.log(`[ChatbotEngine] High-priority system trigger "${triggerType}" — ending active session for contact ${contactId}`);
          await activeSession.destroy();
        } else {
          console.log(`[ChatbotEngine] Skipping system trigger "${triggerType}" — session already active for contact ${contactId}`);
          return;
        }
      }

      const flow = await this.findSystemFlow(triggerType, contact, payload);
      if (flow) return await this.startFlow(flow, contact, conversationId);

    } catch (err) {
      console.error(`[ChatbotEngine] triggerSystemFlow error (${triggerType}):`, err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERRUPT CHECK
  // Only runs for plain-text messages while a session is active.
  // Keyword flows represent explicit intent and can cut in when the session
  // is at a safe pause point (message node waiting for reply).
  // ─────────────────────────────────────────────────────────────────────────

  async findInterruptingFlow(session, messageText) {
    const flow = await BotFlow.findByPk(session.flowId);
    if (!flow) return null;

    const currentNode = flow.nodes.find(n => n.id === session.currentNodeId);
    if (!currentNode) return null;

    // Only interrupt at a plain message wait — never mid collect_input or interactive_reply
    const safeToInterrupt = currentNode.type === 'message' && currentNode.waitForReply;
    if (!safeToInterrupt) return null;

    const candidates = await BotFlow.findAll({
      where: { isActive: true, triggerType: 'keyword_match' },
    });
    const lower = messageText.toLowerCase();

    for (const candidate of candidates) {
      if (candidate.id === session.flowId) continue;
      if (!candidate.triggerKeywords?.length) continue;
      if (candidate.triggerKeywords.some(kw => lower.includes(kw.toLowerCase()))) {
        return candidate;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLOW MATCHING — customer triggers
  // ─────────────────────────────────────────────────────────────────────────

  async findMatchingFlow(contact, messageText, triggerType, buttonId = null) {
    const flows = await BotFlow.findAll({
      where: { isActive: true, triggerType: CUSTOMER_TRIGGER_PRIORITY },
    });

    const sorted = [...flows].sort((a, b) => {
      const ai = CUSTOMER_TRIGGER_PRIORITY.indexOf(a.triggerType);
      const bi = CUSTOMER_TRIGGER_PRIORITY.indexOf(b.triggerType);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    // Two-pass for interactivemessage: specific button ID matches first,
    // then catch-all flows, so a catch-all never beats a specific match.
    if (triggerType === 'interactivemessage') {
      const interactiveFlows = sorted.filter(f => f.triggerType === 'interactivemessage');

      // Pass 1 — exact button ID match
      for (const flow of interactiveFlows) {
        if (flow.triggerButtonIds?.length && buttonId != null && flow.triggerButtonIds.includes(buttonId)) {
          console.log(`[DEBUG] interactivemessage "${flow.name}" — buttonId: "${buttonId}" matched [${flow.triggerButtonIds}]`);
          return flow;
        }
      }

      // Pass 2 — explicit catch-all only
      for (const flow of interactiveFlows) {
        if (flow.catchAll && !flow.triggerButtonIds?.length) {
          console.log(`[DEBUG] interactivemessage catch-all flow "${flow.name}" firing for buttonId: "${buttonId}"`);
          return flow;
        }
      }

      // No match — log and bail so other trigger types don't accidentally handle it
      console.warn(`[ChatbotEngine] No interactivemessage flow matched buttonId: "${buttonId}"`);
      return null;
    }

    // Standard single-pass for all other trigger types
    for (const flow of sorted) {
      const matched = await this.evaluateTrigger(flow, contact, messageText, triggerType, buttonId);
      if (matched) return flow;
    }
    return null;
  }

  async evaluateTrigger(flow, contact, messageText, triggerType, buttonId = null) {
    switch (flow.triggerType) {

      case 'first_time_user': {
        const priorBotMsg = await Message.count({
          include: [{
            model:      Conversation,
            where:      { contactId: contact.id },
            attributes: [],
          }],
          where: { senderType: 'bot' },
        });
        return priorBotMsg === 0;
      }

      case 'any_message':
        return true;

      case 'keyword_match': {
        if (!flow.triggerKeywords?.length) return false;
        const lower  = messageText.toLowerCase();
        const result = flow.triggerKeywords.some(kw => lower.includes(kw.toLowerCase()));
        console.log(`[DEBUG] keyword_match "${flow.name}" — message: "${lower}" | keywords: [${flow.triggerKeywords}] | matched: ${result}`);
        return result;
      }

      case 'inbound_message':
        return triggerType === 'inbound_message';

      // interactivemessage is handled entirely in findMatchingFlow (two-pass).
      // This case should never be reached, but guards against direct calls.
      case 'interactivemessage': {
        if (triggerType !== 'interactivemessage') return false;
        if (!flow.triggerButtonIds?.length && !flow.catchAll) {
          console.warn(`[ChatbotEngine] interactivemessage flow "${flow.name}" has no triggerButtonIds and catchAll is false — skipping (fix your flow config)`);
          return false;
        }
        if (flow.catchAll && !flow.triggerButtonIds?.length) return true;
        const result = buttonId != null && flow.triggerButtonIds.includes(buttonId);
        console.log(`[DEBUG] interactivemessage "${flow.name}" — buttonId: "${buttonId}" | expected: [${flow.triggerButtonIds}] | matched: ${result}`);
        return result;
      }

      default:
        console.warn(`[ChatbotEngine] Unknown customer triggerType: "${flow.triggerType}" on flow "${flow.name}"`);
        return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLOW MATCHING — system triggers
  // ─────────────────────────────────────────────────────────────────────────

  async findSystemFlow(triggerType, contact, payload = {}) {
    const flows = await BotFlow.findAll({ where: { isActive: true, triggerType } });

    for (const flow of flows) {
      const matched = await this.evaluateSystemTrigger(flow, contact, payload);
      if (matched) return flow;
    }
    return null;
  }

  async evaluateSystemTrigger(flow, contact, payload = {}) {
    switch (flow.triggerType) {

      case 'conversation_assigned':
        // Optionally restrict to specific agent IDs
        if (flow.triggerAgentIds?.length) {
          return flow.triggerAgentIds.includes(payload.agentId);
        }
        return true;

      case 'conversation_resolved':
        return true;

      case 'contact_tag_added':
        if (!flow.triggerTags?.length) return false;
        return flow.triggerTags.includes(payload.tag);

      case 'scheduled':
        // Schedule matching is handled by the cron job before calling triggerSystemFlow.
        // By the time we reach here the schedule already fired — always match.
        return true;

      case 'webhook':
        // Optionally filter to a specific webhook event name
        if (flow.triggerWebhookEvent && payload.event !== flow.triggerWebhookEvent) return false;
        return true;

      default:
        console.warn(`[ChatbotEngine] Unknown system triggerType: "${flow.triggerType}" on flow "${flow.name}"`);
        return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLOW LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  async startFlow(flow, contact, conversationId) {
    console.log(`[ChatbotEngine] Starting flow "${flow.name}" (trigger: ${flow.triggerType}) for contact ${contact.id}`);

    const startNode = flow.nodes.find(n => n.id === flow.startNodeId);
    if (!startNode) {
      console.error(`[ChatbotEngine] startNodeId "${flow.startNodeId}" not found in flow "${flow.name}"`);
      return;
    }

    const session = await Session.create({
      contactId:     contact.id,
      flowId:        flow.id,
      currentNodeId: startNode.id,
      contextData:   {},
    });

    await this.executeNode(startNode, session, flow, contact, conversationId);
  }

  /**
   * Resumes a flow using the customer's latest reply.
   *
   * CASE 1 — collect_input node      : save text reply, advance to nextNodeId
   * CASE 2 — message + waitForReply  : advance to nextNodeId
   *           If nextNodeId is collect_input, absorb the reply there too and advance again
   * CASE 3 — interactive_reply node  : match buttonId to the correct branch
   */
  async resumeFlow(session, messageText, contact, conversationId, buttonId = null) {
    const flow = await BotFlow.findByPk(session.flowId);
    if (!flow) {
      await session.destroy();
      return;
    }

    const currentNode = flow.nodes.find(n => n.id === session.currentNodeId);
    if (!currentNode) {
      await session.destroy();
      return;
    }

    console.log(`[ChatbotEngine] Resuming from node type="${currentNode.type}" id="${currentNode.id}"`);

    // ── CASE 1: collect_input ───────────────────────────────────────────
    if (currentNode.type === 'collect_input') {
      const updatedContext = { ...session.contextData, [currentNode.saveAs]: messageText };
      await session.update({ contextData: updatedContext });
      console.log(`[ChatbotEngine] Collected "${currentNode.saveAs}" = "${messageText}"`);

      if (currentNode.nextNodeId) {
        const nextNode = flow.nodes.find(n => n.id === currentNode.nextNodeId);
        if (nextNode) {
          await session.update({ currentNodeId: nextNode.id });
          return await this.executeNode(nextNode, session, flow, contact, conversationId);
        }
      }
      await session.destroy();
      return;
    }

    // ── CASE 2: message + waitForReply ──────────────────────────────────
    if (currentNode.type === 'message' && currentNode.waitForReply) {
      if (currentNode.nextNodeId) {
        const nextNode = flow.nodes.find(n => n.id === currentNode.nextNodeId);
        if (nextNode) {
          await session.update({ currentNodeId: nextNode.id });

          // If next node is collect_input, absorb the reply immediately
          if (nextNode.type === 'collect_input') {
            const updatedContext = { ...session.contextData, [nextNode.saveAs]: messageText };
            await session.update({ contextData: updatedContext });
            console.log(`[ChatbotEngine] Collected "${nextNode.saveAs}" = "${messageText}"`);

            if (nextNode.nextNodeId) {
              const afterCollect = flow.nodes.find(n => n.id === nextNode.nextNodeId);
              if (afterCollect) {
                await session.update({ currentNodeId: afterCollect.id });
                return await this.executeNode(afterCollect, session, flow, contact, conversationId);
              }
            }
            await session.destroy();
            return;
          }

          return await this.executeNode(nextNode, session, flow, contact, conversationId);
        }
      }
      await session.destroy();
      return;
    }

    // ── CASE 3: interactive_reply — match button tap to branch ──────────
    if (currentNode.type === 'interactive_reply') {
      if (!buttonId) {
        // Customer typed text instead of tapping — nudge them back, hold position
        console.warn(`[ChatbotEngine] Expected button tap on node "${currentNode.id}" but got plain text`);
        await this.sendBotMessage(conversationId, contact, 'Please choose one of the options above.');
        return;
      }

      const tapped = currentNode.buttons?.find(b => b.id === buttonId);
      if (!tapped) {
        console.warn(`[ChatbotEngine] Unknown buttonId "${buttonId}" on node "${currentNode.id}"`);
        await this.sendBotMessage(conversationId, contact, 'Please choose one of the options above.');
        return;
      }

      console.log(`[ChatbotEngine] Button tapped: "${tapped.label}" → nextNodeId "${tapped.nextNodeId}"`);

      // Save chosen label so flows can use {{choice}} in later messages
      const updatedContext = { ...session.contextData, choice: tapped.label };
      await session.update({ contextData: updatedContext, currentNodeId: tapped.nextNodeId });

      const nextNode = flow.nodes.find(n => n.id === tapped.nextNodeId);
      if (nextNode) {
        return await this.executeNode(nextNode, session, flow, contact, conversationId);
      }

      await session.destroy();
      return;
    }

    await session.destroy();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NODE EXECUTION
  // ─────────────────────────────────────────────────────────────────────────

  async executeNode(node, session, flow, contact, conversationId) {
    console.log(`[ChatbotEngine] Executing node type="${node.type}" id="${node.id}"`);

    switch (node.type) {

      // ── Plain text message ────────────────────────────────────────────
      case 'message': {
        const text = this.interpolate(node.message, contact, session.contextData);
        await this.sendBotMessage(conversationId, contact, text);

        if (!node.waitForReply && node.nextNodeId) {
          const nextNode = flow.nodes.find(n => n.id === node.nextNodeId);
          if (nextNode) {
            await session.update({ currentNodeId: nextNode.id });
            return await this.executeNode(nextNode, session, flow, contact, conversationId);
          }
        }

        if (!node.waitForReply && !node.nextNodeId) {
          await session.destroy();
        }

        // waitForReply=true: session stays here, resumeFlow CASE 2 handles the reply
        break;
      }

      // ── Wait for plain-text input ─────────────────────────────────────
      case 'collect_input': {
        // Park session here; resumeFlow CASE 1 handles the reply
        await session.update({ currentNodeId: node.id });
        break;
      }

      // ── WhatsApp button list ──────────────────────────────────────────
      // Node shape:
      // {
      //   id: 'node_x',
      //   type: 'interactive_reply',
      //   message: 'Which plan interests you?',
      //   buttons: [
      //     { id: 'btn_starter', label: 'Starter',    nextNodeId: 'node_a' },
      //     { id: 'btn_pro',     label: 'Pro',         nextNodeId: 'node_b' },
      //   ],
      // }
      case 'interactive_reply': {
        const text = this.interpolate(node.message, contact, session.contextData);
        await this.sendBotMessage(conversationId, contact, text, {
          type:    'interactive',
          buttons: node.buttons.map(b => ({ id: b.id, title: b.label })),
        });
        // Park session here; resumeFlow CASE 3 handles the button tap
        await session.update({ currentNodeId: node.id });
        break;
      }

      // ── Condition / if-else branch ────────────────────────────────────
      // Node shape:
      // {
      //   id: 'node_x',
      //   type: 'condition',
      //   field: 'wantsSalesCall',        // key from contextData to evaluate
      //   conditions: [
      //     { match: 'yes',  nextNodeId: 'node_yes' },
      //     { match: 'no',   nextNodeId: 'node_no'  },
      //     { match: '*',    nextNodeId: 'node_fallback' }, // default/else
      //   ]
      // }
      case 'condition': {
        const value = (session.contextData[node.field] || '').toLowerCase().trim();
        const matched =
          node.conditions.find(c => c.match !== '*' && value.includes(c.match.toLowerCase())) ||
          node.conditions.find(c => c.match === '*');

        if (!matched) {
          console.warn(`[ChatbotEngine] condition node "${node.id}" — no match for value "${value}"`);
          await session.destroy();
          return;
        }

        console.log(`[ChatbotEngine] condition "${node.id}" — "${value}" matched "${matched.match}" → "${matched.nextNodeId}"`);

        const nextNode = flow.nodes.find(n => n.id === matched.nextNodeId);
        if (nextNode) {
          await session.update({ currentNodeId: nextNode.id });
          return await this.executeNode(nextNode, session, flow, contact, conversationId);
        }
        await session.destroy();
        break;
      }

      // ── End of flow ───────────────────────────────────────────────────
      case 'end': {
        if (node.message) {
          const text = this.interpolate(node.message, contact, session.contextData);
          await this.sendBotMessage(conversationId, contact, text);
        }
        await session.destroy();
        console.log(`[ChatbotEngine] Flow ended for contact ${contact.id}`);
        break;
      }

      default:
        console.warn(`[ChatbotEngine] Unknown node type: "${node.type}"`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Saves a bot message to DB and emits it via socket.io.
   * `extra` carries the interactive button payload when node type is interactive_reply.
   */
  async sendBotMessage(conversationId, contact, text, extra = null) {
    try {
      const saved = await Message.create({
        conversationId,
        senderType:     'bot',
        message:        text,
        meta:           extra,       // requires `meta` JSON column on Messages table
        timestamp:      new Date(),
        deliveryStatus: 'sent',
      });

      socketHandler.emitNewMessage({
        conversationId,
        contactId: contact.id,
        message:   saved,
      });

      console.log(`[ChatbotEngine] Bot sent: "${text}"${extra ? ' [interactive]' : ''}`);
      return saved;
    } catch (err) {
      console.error('[ChatbotEngine] Failed to send bot message:', err);
    }
  }

  /**
   * Replaces {{name}}, {{phone}}, {{choice}}, and any collected field
   * placeholders in message strings.
   */
  interpolate(template, contact, contextData = {}) {
    return template
      .replace(/{{name}}/g,  contact.name  || 'there')
      .replace(/{{phone}}/g, contact.phone || '')
      .replace(/{{(\w+)}}/g, (_, key) => contextData[key] ?? '');
  }
}

module.exports = new ChatbotEngine();