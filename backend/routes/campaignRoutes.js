const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { getStats, getCampaigns, createCampaign, updateCampaignStatus, sendCampaign, markContactRead } = require('../controllers/campaignController');

router.use(protect);

router.get('/stats', getStats);
router.get('/', getCampaigns);
router.post('/', createCampaign);
router.patch('/mark-read/:contactId', markContactRead);
router.patch('/:id/status', updateCampaignStatus);
router.post('/:id/send', sendCampaign);

module.exports = router;