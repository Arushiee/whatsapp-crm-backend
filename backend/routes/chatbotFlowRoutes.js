/**
 * chatbotFlowRoutes.js
 * CRUD API for BotFlow model.
 * Add to app.js: app.use('/chatbot-flows', require('./routes/chatbotFlowRoutes'))
 */
const express = require('express');
const router = express.Router();
const { BotFlow, Session } = require('../models');

const VALID_TRIGGER_TYPES = [
  'first_time_user',
  'any_message',
  'keyword_match',
  'inbound_message',
  'interactivemessage',
];

// GET /chatbot-flows — list all flows
router.get('/', async (req, res) => {
  try {
    const flows = await BotFlow.findAll({ order: [['createdAt', 'ASC']] });
    res.json({ status: 'success', data: flows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /chatbot-flows — create a new flow
router.post('/', async (req, res) => {
  console.log('CREATE BODY:', req.body);
  try {
    const { name, description, triggerType, triggerKeywords, triggerButtonIds, nodes, startNodeId } = req.body;

    if (!name || !startNodeId) {
      return res.status(400).json({ status: 'fail', message: 'name and startNodeId are required' });
    }

    const flow = await BotFlow.create({
      name,
      description,
      triggerType: triggerType || 'first_time_user',
      triggerKeywords: triggerKeywords || [],
      triggerButtonIds: triggerButtonIds || [],
      nodes: nodes || [],
      startNodeId,
      isActive: true,
    });

    console.log('SAVED FLOW:', flow.toJSON());
    res.status(201).json({ status: 'success', data: flow });
  } catch (err) {
    console.error('CREATE ERROR:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// PUT /chatbot-flows/:id — update a flow
router.put('/:id', async (req, res) => {
  try {
    const flow = await BotFlow.findByPk(req.params.id);
    if (!flow) return res.status(404).json({ status: 'fail', message: 'Flow not found' });

    const { name, description, triggerType, triggerKeywords, triggerButtonIds, nodes, startNodeId } = req.body;

    if (triggerType && !VALID_TRIGGER_TYPES.includes(triggerType)) {
      return res.status(400).json({ status: 'fail', message: `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(', ')}` });
    }

    if (triggerType === 'keyword_match' && (!triggerKeywords || triggerKeywords.length === 0)) {
      return res.status(400).json({ status: 'fail', message: 'keyword_match trigger requires at least one triggerKeyword' });
    }

    if (triggerType === 'interactivemessage' && (!triggerButtonIds || triggerButtonIds.length === 0)) {
      return res.status(400).json({ status: 'fail', message: 'interactivemessage trigger requires at least one triggerButtonId' });
    }

    await flow.update({
      name,
      description,
      triggerType: triggerType || flow.triggerType,
      triggerKeywords: triggerKeywords ?? flow.triggerKeywords,
      triggerButtonIds: triggerButtonIds ?? flow.triggerButtonIds,
      nodes: nodes ?? flow.nodes,
      startNodeId: startNodeId ?? flow.startNodeId,
    });

    res.json({ status: 'success', data: flow });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// PATCH /chatbot-flows/:id/toggle — enable/disable
router.patch('/:id/toggle', async (req, res) => {
  try {
    const flow = await BotFlow.findByPk(req.params.id);
    if (!flow) return res.status(404).json({ status: 'fail', message: 'Flow not found' });

    await flow.update({ isActive: !flow.isActive });
    res.json({ status: 'success', data: flow });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// DELETE /chatbot-flows/:id
router.delete('/:id', async (req, res) => {
  try {
    const flow = await BotFlow.findByPk(req.params.id);
    if (!flow) return res.status(404).json({ status: 'fail', message: 'Flow not found' });

    await flow.destroy();
    res.json({ status: 'success', message: 'Flow deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;