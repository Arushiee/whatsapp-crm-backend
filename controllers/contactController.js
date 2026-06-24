const ContactService = require('../services/ContactService');

class ContactController {
  /**
   * Get all contacts (supports query filters like leadStatus, tag, assignedAgent)
   */
  async getAllContacts(req, res, next) {
    try {
      const contacts = await ContactService.getAllContacts(req.query);
      res.status(200).json({
        status: 'success',
        results: contacts.length,
        data: { contacts }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific contact by ID
   */
  async getContactById(req, res, next) {
    try {
      const contact = await ContactService.getContactById(req.params.id);
      res.status(200).json({
        status: 'success',
        data: { contact }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new contact
   */
  async createContact(req, res, next) {
    try {
      const { name, phone, email, avatar, leadStatus, assignedAgent, tags, notes, followUpDate } = req.body;
      const newContact = await ContactService.createContact({
        name,
        phone,
        email: email || '',
        avatar: avatar || '',
        leadStatus: leadStatus || 'new',
        assignedAgent: assignedAgent || null,
        tags: tags || [],
        notes: notes || '',
        followUpDate: followUpDate || null
      });
      res.status(201).json({
        status: 'success',
        data: { contact: newContact }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a contact (supports updating leadStatus, assignedAgent, notes, tags, followUpDate, name, phone, email, etc.)
   */
  async updateContact(req, res, next) {
    try {
      const updateFields = {};
      const allowedFields = [
        'name', 'phone', 'email', 'avatar', 'leadStatus',
        'assignedAgent', 'tags', 'notes', 'followUpDate'
      ];
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateFields[field] = req.body[field];
        }
      });
      if (req.body.assignedAgent === null || req.body.assignedAgent === '') {
        updateFields.assignedAgent = null;
      }
      if (req.body.followUpDate === null || req.body.followUpDate === '') {
        updateFields.followUpDate = null;
      }
      await ContactService.updateContact(req.params.id, updateFields);
      // Re-fetch with conversation merge so assignedAgent is correct
      const updatedContact = await ContactService.getContactById(req.params.id);
      res.status(200).json({
        status: 'success',
        data: { contact: updatedContact }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark contact messages as read (sets unreadCount to 0)
   */
  async markAsRead(req, res, next) {
    try {
      await ContactService.updateContact(req.params.id, { unreadCount: 0 });
      const updatedContact = await ContactService.getContactById(req.params.id);
      res.status(200).json({
        status: 'success',
        data: { contact: updatedContact }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete contact
   */
  async deleteContact(req, res, next) {
    try {
      await ContactService.deleteContact(req.params.id);
      res.status(204).json({
        status: 'success',
        data: null
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ContactController();