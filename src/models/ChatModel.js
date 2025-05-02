const mongoose = require("mongoose");

const ChatSchema = mongoose.Schema(
    {
        participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }],
        lastMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Message'
        },
        unreadCount: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

// Index for faster querying
ChatSchema.index({ participants: 1, lastMessage: -1 });

module.exports = mongoose.model('Chat', ChatSchema);