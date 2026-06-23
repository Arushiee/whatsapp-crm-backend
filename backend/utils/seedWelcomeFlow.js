/**
 * seedWelcomeFlow.js
 * Creates the "Welcome New Users" bot flow in your DB.
 *
 * Run once:
 *   node utils/seedWelcomeFlow.js
 *
 * Flow:
 *   1. Bot greets the customer
 *   2. Asks for their name → saves it
 *   3. Asks for their email → saves it
 *   4. Tells them an agent will be with them shortly
 */

require('dotenv').config();
const { sequelize, BotFlow } = require('../models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected');

    const existing = await BotFlow.findOne({ where: { name: 'Welcome New Users' } });
    if (existing) {
      console.log('ℹ️  Welcome flow already exists — skipping');
      process.exit(0);
    }

    const flow = await BotFlow.create({
      name: 'Welcome New Users',
      description: 'Greets new contacts, collects their name and email, then queues for agent.',
      triggerKeywords: [], // Empty = triggers for first-time users on any message
      isActive: true,
      startNodeId: 'node_1',
      nodes: [
        {
          id: 'node_1',
          type: 'message',
          message: 'Hi there! 👋 Welcome! I\'m here to help. What\'s your name?',
          waitForReply: true,   // Pause here, wait for customer to type their name
          nextNodeId: 'node_2',
        },
        {
          id: 'node_2',
          type: 'collect_input', // Save whatever they type as 'collectedName'
          saveAs: 'collectedName',
          nextNodeId: 'node_3',
        },
        {
          id: 'node_3',
          type: 'message',
          message: 'Nice to meet you, {{collectedName}}! 😊 Could you share your email address so we can follow up?',
          waitForReply: true,   // Pause here, wait for email
          nextNodeId: 'node_4',
        },
        {
          id: 'node_4',
          type: 'collect_input', // Save their email as 'collectedEmail'
          saveAs: 'collectedEmail',
          nextNodeId: 'node_5',
        },
        {
          id: 'node_5',
          type: 'end',
          message: 'Thanks {{collectedName}}! 🙏 An agent will be with you shortly. Please hold on.',
        },
      ],
    });

    console.log('✅ Welcome flow created! ID:', flow.id);
    console.log('');
    console.log('Flow steps:');
    console.log('  node_1 → Greet + ask name');
    console.log('  node_2 → Collect name');
    console.log('  node_3 → Ask for email');
    console.log('  node_4 → Collect email');
    console.log('  node_5 → Thank + hand off to agent');
    process.exit(0);

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();