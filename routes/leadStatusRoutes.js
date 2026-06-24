const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', (req, res) => {
  const leadStatuses = [
    { id: 'ls1', label: 'New' },
    { id: 'ls2', label: 'Contacted' },
    { id: 'ls3', label: 'Qualified' },
    { id: 'ls4', label: 'Proposal' },
    { id: 'ls5', label: 'Negotiation' },
    { id: 'ls6', label: 'Closed Won' },
    { id: 'ls7', label: 'Closed Lost' },
  ];
  res.status(200).json(leadStatuses);
});

module.exports = router;
