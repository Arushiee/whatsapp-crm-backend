const express = require('express');
const messageController = require('../controllers/messageController');
const protect = require('../middleware/authMiddleware');
const { sendMessageValidator } = require('../utils/validators');

const router = express.Router();

// Apply JWT authentication protection to all message routes
router.use(protect);

router.post('/', sendMessageValidator, messageController.sendMessage);
router.get('/:contactId', messageController.getMessagesByContactId);

module.exports = router;
