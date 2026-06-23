const express = require('express');
const contactController = require('../controllers/contactController');
const protect = require('../middleware/authMiddleware');
const { createContactValidator, updateContactValidator } = require('../utils/validators');
const router = express.Router();

// Apply JWT authentication protection to all contact routes
router.use(protect);

router.route('/')
  .get(contactController.getAllContacts)
  .post(createContactValidator, contactController.createContact);

router.patch('/:id/read', contactController.markAsRead);

router.route('/:id')
  .get(contactController.getContactById)
  .put(updateContactValidator, contactController.updateContact)
  .delete(contactController.deleteContact);

module.exports = router;