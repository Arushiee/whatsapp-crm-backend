const express = require('express');
const protect = require('../middleware/authMiddleware');
const ConversationService = require('../services/ConversationService');

const router = express.Router();

router.use(protect);

// GET all queued conversations (unassigned, waiting)
router.get('/queue', async (req, res, next) => {
  try {
    const queued = await ConversationService.getQueuedConversations();
    res.status(200).json({ status: 'success', data: { conversations: queued } });
  } catch (err) {
    next(err);
  }
});

// GET all assigned/open conversations
router.get('/assigned', async (req, res, next) => {
  try {
    const assigned = await ConversationService.getAssignedConversations();
    res.status(200).json({ status: 'success', data: { conversations: assigned } });
  } catch (err) {
    next(err);
  }
});

// POST assign an agent to a conversation — moves it from queue → assigned
router.post('/:id/assign', async (req, res, next) => {
  try {
    const { agentName } = req.body;
    if (!agentName) {
      return res.status(400).json({ status: 'fail', message: 'agentName is required' });
    }
    const conversation = await ConversationService.assignAgent(req.params.id, agentName);
    res.status(200).json({ status: 'success', data: { conversation } });
  } catch (err) {
    next(err);
  }
});

// PATCH update conversation status (open / snoozed / closed)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const conversation = await ConversationService.updateConversationStatus(req.params.id, status);
    res.status(200).json({ status: 'success', data: { conversation } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;