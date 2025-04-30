const User = require("../models/UserModel");
const { sendResponse } = require("../helpers/response");
const { Message } = require("../helpers/messages");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET; // Make sure to set this in your environment variables

exports.signUp = async (req, res) => {
    try {
        const { firstName, lastName, email, mobile, password } = req.body;

        // Check if email already exists
        const emailExist = await User.findOne({ email: email.toLowerCase().trim() });
        if (emailExist) return sendResponse(res, 400, Message.EMAIL_EXISTS);

        // Check if mobile number already exists
        const phoneExist = await User.findOne({ mobile: mobile.trim() });
        if (phoneExist) return sendResponse(res, 400, Message.MOBILE_EXISTS);

        // Hash the password
        const hashedPassword = await bcrypt.hash(password?.trim(), 10);

        // Create new user
        const newUser = new User({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            mobile: mobile.trim(),
            password: hashedPassword,
            isEmailVerified: false,
            isMobileVerified: false,
            isActive: true
        });

        // Save the user to database
        const result = await newUser.save();

        // Return success response
        sendResponse(res, 200, result);
        
    } catch (err) {
        console.log(err);
        sendResponse(res, 500, null, err.message);
    }
};



exports.login = async (req, res) => {
    try {
        const { mobile, password } = req.body;

        // Check if mobile number exists
        const user = await User.findOne({ mobile: mobile.trim() });
        if (!user) return sendResponse(res, 404, null, Message.USER_NOT_FOUND);

        // Check if user is active
        if (!user.isActive) return sendResponse(res, 403, null, Message.USER_INACTIVE);

        // Verify password
        const isPasswordValid = await bcrypt.compare(password?.trim(), user.password);
        if (!isPasswordValid) return sendResponse(res, 401, null, Message.INVALID_CREDENTIALS);

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id,
                mobile: user.mobile,
                email: user.email
            },
            secretKey,
            { expiresIn: '24h' } // Token expires in 24 hours
        );

        // Prepare user data for response (excluding sensitive information)
        const userData = {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            mobile: user.mobile,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified
        };

        // Return success response with user data and token
        sendResponse(res, 200, { 
            message: Message.LOGIN_SUCCESS,
            user: userData,
            token: token,
            expiresIn: '24h'
        });
        
    } catch (err) {
        console.log(err);
        sendResponse(res, 500, null, err.message);
    }
};