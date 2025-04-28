const mongoose = require("mongoose");

const UserSchema = mongoose.Schema(
    {
        firstName: {

            type: String,
            required: true,
            trim: true
        },
        lastName: {
            
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/.+\@.+\..+/, 'Please fill a valid email address']
        },
        mobile: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            match: [/^[0-9]{10}$/, 'Please fill a valid mobile number']
        },
        password: {
            type: String,
            required: true
        },
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        isMobileVerified: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);