const Message = require("../models/MessageModel");
const Chat = require("../models/ChatModel");
const User = require("../models/UserModel");
const { sendResponse } = require("../helpers/response");
const { Message: MessageConstants } = require("../helpers/messages");

exports.sendMessage = async (req, res) => {
    try {
        const { receiverId, content, messageType = 'text' } = req.body;
        const senderId = req.user.userId;

        // Validate receiver
        const receiver = await User.findById(receiverId);
        if (!receiver) return sendResponse(res, 404, null, MessageConstants.USER_NOT_FOUND);

        // Create and save new message
        const newMessage = new Message({
            sender: senderId,
            receiver: receiverId,
            content,
            messageType
        });

        const savedMessage = await newMessage.save();

        // Check if a chat already exists
        let chat = await Chat.findOne({ participants: { $all: [senderId, receiverId] } });

        if (!chat) {
            chat = new Chat({
                participants: [senderId, receiverId],
                lastMessage: savedMessage._id,
                unreadCount: 1
            });
            await chat.save();
        } else {
            chat.lastMessage = savedMessage._id;
            chat.unreadCount += 1;
            await chat.save();
        }

        // WebSocket notification
        if (req.app.get('io')) {
            const io = req.app.get('io');
            
            // Make sure the receiver is connected to a room
            const receiverSocket = io.sockets.adapter.rooms.get(receiverId.toString());
            
            if (receiverSocket) {
                // Convert savedMessage to a plain object if it's a Mongoose document
                const messageToSend = savedMessage.toObject ? savedMessage.toObject() : savedMessage;
                
                // Add populated sender information if needed
                if (!messageToSend.senderDetails && savedMessage.populated('sender')) {
                    messageToSend.senderDetails = {
                        _id: savedMessage.sender._id,
                        firstName: savedMessage.sender.firstName,
                        lastName: savedMessage.sender.lastName
                    };
                }

                io.to(receiverId.toString()).emit('newMessage', messageToSend);
            }
            
            // Also notify the sender (optional)
            io.to(senderId.toString()).emit('messageSent', {
                _id: savedMessage._id,
                status: 'delivered'
            });
        }

        sendResponse(res, 201, savedMessage);

    } catch (err) {
        console.error(err);
        sendResponse(res, 500, null, err.message);
    }
};


// Get messages between two users
exports.getMessages = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.userId;

        // Validate if the other user exists
        const otherUser = await User.findById(userId);
        if (!otherUser) return sendResponse(res, 404, null, MessageConstants.USER_NOT_FOUND);

        // Get messages with infinite scroll support
        const limit = parseInt(req.query.limit) || 20;
        const lastId = req.query.lastId;

        let query = {
            $or: [
                { sender: currentUserId, receiver: userId },
                { sender: userId, receiver: currentUserId }
            ]
        };

        if (lastId) {
            query._id = { $lt: lastId }; // For pagination (getting older messages)
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sender', 'firstName lastName')
            .populate('receiver', 'firstName lastName');

        // Mark messages as read if they're being fetched by the receiver
        if (userId !== currentUserId.toString()) {
            await Message.updateMany(
                { sender: userId, receiver: currentUserId, isRead: false },
                { $set: { isRead: true, readAt: new Date(), status: 'read' } }
            );

            // Update chat unread count
            await Chat.findOneAndUpdate(
                { participants: { $all: [currentUserId, userId] } },
                { $set: { unreadCount: 0 } }
            );
        }

        sendResponse(res, 200, messages.reverse()); // Return oldest first
        
    } catch (err) {
        console.log(err);
        sendResponse(res, 500, null, err.message);
    }
};

// Get all chats for a user
exports.getChats = async (req, res) => {
    try {
        const userId = req.user.userId;

        const chats = await Chat.find({ participants: userId })
            .populate({
                path: 'participants',
                select: 'firstName lastName',
                match: { _id: { $ne: userId } }
            })
            .populate({
                path: 'lastMessage',
                populate: [
                    { path: 'sender', select: 'firstName lastName' },
                    { path: 'receiver', select: 'firstName lastName' }
                ]
            })
            .sort({ updatedAt: -1 });

        sendResponse(res, 200, chats);
        
    } catch (err) {
        console.log(err);
        sendResponse(res, 500, null, err.message);
    }
};