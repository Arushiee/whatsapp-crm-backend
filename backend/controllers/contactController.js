const ContactService = require('../services/ContactService');

class ContactController {
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
      const updatedContact = await ContactService.getContactById(req.params.id);
      res.status(200).json({
        status: 'success',
        data: { contact: updatedContact }
      });
    } catch (error) {
      next(error);
    }
  }

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

  // ✅ NEW: added missing markAsUnread method
  async markAsUnread(req, res, next) {
    try {
      await ContactService.updateContact(req.params.id, { unreadCount: 1 });
      const updatedContact = await ContactService.getContactById(req.params.id);
      res.status(200).json({
        status: 'success',
        data: { contact: updatedContact }
      });
    } catch (error) {
      next(error);
    }
  }

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