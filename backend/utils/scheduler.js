/**
 * utils/scheduler.js
 * Time-based bot triggers using node-cron.
 *
 * Install dependency if not already present:
 *   npm install node-cron
 *
 * Import once in your app entry point (app.js / server.js / index.js):
 *   require('./utils/scheduler');
 */

const cron          = require('node-cron');
const ChatbotEngine = require('../services/ChatbotEngine');
const { Contact, Conversation } = require('../models');

// ─── Example: fire a scheduled flow every day at 9:00 AM ─────────────────
// Replace the Contact.findAll condition with whatever selects
// the right contacts for your use case (opted-in users, trial expiring, etc.)

cron.schedule('0 9 * * *', async () => {
  console.log('[Scheduler] Running scheduled bot trigger — 9:00 AM');

  try {
    // Find contacts that have scheduled bot enabled
    const contacts = await Contact.findAll({
      where: { scheduledBotEnabled: true },
    });

    for (const contact of contacts) {
      try {
        // Find their active conversation
        const conversation = await Conversation.findOne({
          where: { contactId: contact.id },
        });

        if (!conversation) {
          console.warn(`[Scheduler] No conversation found for contact ${contact.id} — skipping`);
          continue;
        }

        await ChatbotEngine.triggerSystemFlow({
          triggerType:    'scheduled',
          contactId:      contact.id,
          conversationId: conversation.id,
        });

      } catch (err) {
        console.error(`[Scheduler] Failed for contact ${contact.id}:`, err.message);
      }
    }

  } catch (err) {
    console.error('[Scheduler] Cron job error:', err);
  }
});

// ─── Add more schedules below as needed ───────────────────────────────────
// e.g. follow-up reminder every Monday at 10 AM:
//
// cron.schedule('0 10 * * 1', async () => {
//   // find contacts needing follow-up and call triggerSystemFlow
// });

console.log('[Scheduler] Cron jobs registered');