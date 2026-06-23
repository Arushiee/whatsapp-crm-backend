const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', (req, res) => {
  const agents = [
    { id: 'a1', name: 'Support Bot' },
    { id: 'a2', name: 'Alice Johnson' },
    { id: 'a3', name: 'Bob Smith' },
    { id: 'a4', name: 'Unassigned' },
  ];
  res.status(200).json(agents);
});

module.exports = router;
