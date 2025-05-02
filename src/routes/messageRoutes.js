const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { ValidateToken } = require('../middleware/auth');

// Protect all message routes with authentication
router.use(ValidateToken);

// Message routes
router.post('/send', messageController.sendMessage);
router.get('/:userId', messageController.getMessages);
router.get('/chats/list', messageController.getChats);

module.exports = router;