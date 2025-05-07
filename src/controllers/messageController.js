const Message = require('../models/MessageModel');
const Chat = require('../models/ChatModel');
const User = require('../models/UserModel');
const { sendResponse } = require('../helpers/response');
const { Message: MessageConstants } = require('../helpers/messages');

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, messageType = 'text' } = req.body;
    const senderId = req.user.userId;

    const receiver = await User.findById(receiverId);
    if (!receiver) return sendResponse(res, 404, null, MessageConstants.USER_NOT_FOUND);

    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      messageType,
      status: 'sent',
    });

    const savedMessage = await newMessage.save();

    let chat = await Chat.findOne({ participants: { $all: [senderId, receiverId] } });

    if (!chat) {
      chat = new Chat({
        participants: [senderId, receiverId],
        lastMessage: savedMessage._id,
        unreadCount: 1,
      });
      await chat.save();
    } else {
      chat.lastMessage = savedMessage._id;
      chat.unreadCount += 1;
      await chat.save();
    }

    const io = req.app.get('io');
    if (io) {
      const messageToSend = await Message.findById(savedMessage._id)
        .populate('sender', 'firstName lastName')
        .populate('receiver', 'firstName lastName');

      io.to(receiverId.toString()).emit('newMessage', messageToSend);
      io.to(senderId.toString()).emit('messageStatus', {
        messageId: savedMessage._id,
        status: 'delivered',
      });

      await Message.findByIdAndUpdate(savedMessage._id, { status: 'delivered' });
    }

    sendResponse(res, 201, savedMessage);
  } catch (err) {
    console.error(err);
    sendResponse(res, 500, null, err.message);
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    const otherUser = await User.findById(userId);
    if (!otherUser) return sendResponse(res, 404, null, MessageConstants.USER_NOT_FOUND);

    const limit = parseInt(req.query.limit) || 20;
    const lastId = req.query.lastId;

    let query = {
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    };

    if (lastId) {
      query._id = { $lt: lastId };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'firstName lastName')
      .populate('receiver', 'firstName lastName');

    if (userId !== currentUserId.toString()) {
      await Message.updateMany(
        { sender: userId, receiver: currentUserId, isRead: false },
        { $set: { isRead: true, readAt: new Date(), status: 'read' } }
      );

      await Chat.findOneAndUpdate(
        { participants: { $all: [currentUserId, userId] } },
        { $set: { unreadCount: 0 } }
      );

      const io = req.app.get('io');
      if (io) {
        io.to(userId).emit('messageStatus', {
          messageId: 'all',
          status: 'read',
        });
      }
    }

    sendResponse(res, 200, messages.reverse());
  } catch (err) {
    console.log(err);
    sendResponse(res, 500, null, err.message);
  }
};

exports.getChats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const chats = await Chat.find({ participants: userId })
      .populate({
        path: 'participants',
        select: 'firstName lastName',
        match: { _id: { $ne: userId } },
      })
      .populate({
        path: 'lastMessage',
        populate: [
          { path: 'sender', select: 'firstName lastName' },
          { path: 'receiver', select: 'firstName lastName' },
        ],
      })
      .sort({ updatedAt: -1 });

    sendResponse(res, 200, chats);
  } catch (err) {
    console.log(err);
    sendResponse(res, 500, null, err.message);
  }
};

exports.markMessagesAsRead = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    const currentUserId = req.user.userId;

    if (receiverId !== currentUserId) {
      return sendResponse(res, 403, null, 'Unauthorized to mark messages as read');
    }

    await Message.updateMany(
      { sender: senderId, receiver: receiverId, isRead: false },
      { $set: { isRead: true, readAt: new Date(), status: 'read' } }
    );

    await Chat.findOneAndUpdate(
      { participants: { $all: [senderId, receiverId] } },
      { $set: { unreadCount: 0 } }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(senderId).emit('messageStatus', {
        messageId: 'all',
        status: 'read',
      });
    }

    sendResponse(res, 200, { success: true });
  } catch (err) {
    console.log(err);
    sendResponse(res, 500, null, err.message);
  }
};