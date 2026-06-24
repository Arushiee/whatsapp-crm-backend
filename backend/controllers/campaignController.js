const { Op } = require('sequelize');
const { sequelize, Campaign, CampaignRecipient, Contact } = require('../models/index');
const whatsappService = require('../services/WhatsAppService');
const MessageService = require('../services/MessageService');

const getStats = async (req, res) => {
  try {
    const totalSent = await CampaignRecipient.count({ where: { status: { [Op.in]: ['sent', 'delivered', 'read'] } } });
    const totalDelivered = await CampaignRecipient.count({ where: { status: { [Op.in]: ['delivered', 'read'] } } });
    const totalRead = await CampaignRecipient.count({ where: { status: 'read' } });
    const totalRecipients = await CampaignRecipient.count();
    const deliveredRate = totalSent > 0 ? parseFloat(((totalDelivered / totalSent) * 100).toFixed(1)) : 0;
    const readRate = totalSent > 0 ? parseFloat(((totalRead / totalSent) * 100).toFixed(1)) : 0;
    res.json({ total_sent: totalSent, delivered_rate: deliveredRate, read_rate: readRate, total_recipients: totalRecipients });
  } catch (err) {
    console.error('[campaigns/stats]', err);
    res.status(500).json({ error: 'Failed to fetch campaign stats' });
  }
};

const getCampaigns = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;
    const status = req.query.status || null;
    const search = req.query.search || null;
    const where = {};
    if (status) where.status = status;
    if (search) where.name = { [Op.like]: `%${search}%` };
    const { count, rows } = await Campaign.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset });
    const campaignsWithStats = await Promise.all(rows.map(async (c) => {
      const [sent, delivered, read, failed, total] = await Promise.all([
        CampaignRecipient.count({ where: { campaignId: c.id, status: { [Op.in]: ['sent', 'delivered', 'read'] } } }),
        CampaignRecipient.count({ where: { campaignId: c.id, status: { [Op.in]: ['delivered', 'read'] } } }),
        CampaignRecipient.count({ where: { campaignId: c.id, status: 'read' } }),
        CampaignRecipient.count({ where: { campaignId: c.id, status: 'failed' } }),
        CampaignRecipient.count({ where: { campaignId: c.id } }),
      ]);
      const readPct = sent > 0 ? parseFloat(((read / sent) * 100).toFixed(1)) : 0;
      return { id: c.id, name: c.name, template_name: c.templateName, status: c.status, scheduled_at: c.scheduledAt, created_at: c.createdAt, recipients: total, sent, delivered, read, failed, read_pct: readPct };
    }));
    res.json({ data: campaignsWithStats, pagination: { page, limit, total: count, total_pages: Math.ceil(count / limit) } });
  } catch (err) {
    console.error('[campaigns GET]', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

const createCampaign = async (req, res) => {
  try {
    const { name, templateName, templateId, scheduledAt } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Campaign name is required' });
    if (!templateName || !templateName.trim()) return res.status(400).json({ error: 'Template name is required' });
    const campaign = await Campaign.create({
      name: name.trim(),
      templateName: templateName.trim(),
      scheduledAt: scheduledAt ?? null,
      status: 'draft',
    });
    res.status(201).json({
      message: 'Campaign created',
      data: {
        id: campaign.id,
        name: campaign.name,
        template_name: campaign.templateName,
        status: campaign.status,
        scheduled_at: campaign.scheduledAt,
        created_at: campaign.createdAt,
      },
    });
  } catch (err) {
    console.error('[campaigns POST]', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
};

const updateCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['draft', 'scheduled', 'sending', 'completed', 'failed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    const campaign = await Campaign.findByPk(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    await campaign.update({ status });
    res.json({ message: 'Status updated', status: campaign.status });
  } catch (err) {
    console.error('[campaigns PATCH status]', err);
    res.status(500).json({ error: 'Failed to update campaign status' });
  }
};

const simulateDeliveryReceipts = (campaignId) => {
  setTimeout(async () => {
    try {
      await CampaignRecipient.update(
        { status: 'delivered' },
        { where: { campaignId, status: 'sent' } }
      );
      console.log(`[simulate] Campaign ${campaignId} → delivered`);
    } catch (e) {
      console.error('[simulate] delivered error:', e.message);
    }
  }, 5000);
};

const sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findByPk(id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status === 'sending' || campaign.status === 'completed')
      return res.status(400).json({ error: `Campaign is already ${campaign.status}` });

    // ── Fetch real template body via raw SQL (no Sequelize model needed) ──────
    let templateBody = null;
    try {
      const [rows] = await sequelize.query(
        'SELECT body FROM templates WHERE name = ? LIMIT 1',
        { replacements: [campaign.templateName] }
      );
      if (rows.length > 0 && rows[0].body) {
        templateBody = rows[0].body;
      }
      console.log(`[sendCampaign] Template body for "${campaign.templateName}":`, templateBody);
    } catch (lookupErr) {
      console.warn('[sendCampaign] Could not look up template body:', lookupErr.message);
    }

    // Use real body, fall back to plain label only if lookup failed
    const messageText = templateBody || `Template: ${campaign.templateName}`;
    // ─────────────────────────────────────────────────────────────────────────

    const contacts = await Contact.findAll();
    if (!contacts.length) return res.status(400).json({ error: 'No contacts found to send to' });

    await campaign.update({ status: 'sending' });

    let sent = 0, failed = 0;

    for (const contact of contacts) {
      try {
        await whatsappService.sendTemplate(contact.phone, campaign.templateName, 'en_US', []);

        // ✅ Save the actual template body as the chat message
        await MessageService.saveMessage({
          contactId: contact.id,
          messageText,
          senderType: 'agent',
        });

        await CampaignRecipient.upsert({
          campaignId: campaign.id,
          contactId: contact.id,
          status: 'sent',
          sentAt: new Date(),
          errorMessage: '',
        });

        sent++;
      } catch (err) {
        console.error(`[sendCampaign] Failed for contact ${contact.id}:`, err.message);
        await CampaignRecipient.upsert({
          campaignId: campaign.id,
          contactId: contact.id,
          status: 'failed',
          errorMessage: err.message || 'Unknown error',
        });
        failed++;
      }
    }

    await campaign.update({ status: 'completed' });
    simulateDeliveryReceipts(campaign.id);

    res.json({ message: 'Campaign sent', total: contacts.length, sent, failed });
  } catch (err) {
    console.error('[campaigns POST send]', err);
    res.status(500).json({ error: 'Failed to send campaign' });
  }
};

const markContactRead = async (req, res) => {
  try {
    const { contactId } = req.params;
    await CampaignRecipient.update(
      { status: 'read' },
      { where: { contactId, status: { [Op.in]: ['sent', 'delivered'] } } }
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('[campaigns mark-read]', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

module.exports = { getStats, getCampaigns, createCampaign, updateCampaignStatus, sendCampaign, markContactRead };