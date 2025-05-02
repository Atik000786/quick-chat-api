const mongoose = require("mongoose");

const MessageSchema = mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true,
            trim: true
        },
        isRead: {
            type: Boolean,
            default: false
        },
        readAt: {
            type: Date
        },
        messageType: {
            type: String,
            enum: ['text', 'image', 'video', 'audio', 'document'],
            default: 'text'
        },
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Message', MessageSchema);