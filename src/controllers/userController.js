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

exports.getAllUsers = async (req, res) => {
    try {
        // Get parameters for infinite scrolling
        const limit = parseInt(req.query.limit) || 10;
        const lastId = req.query.lastId; // The last document ID from the previous batch
        
        // Build base query for active users only (unless admin requests all)
        let query = { isActive: true };
        if (req.user && req.user.isAdmin) {
            query = {};
        }

        // If lastId is provided, add it to the query to get the next batch
        if (lastId) {
            query._id = { $gt: lastId }; // Using $gt for sequential loading
        }

        // Get users with limit and sorting by _id
        const users = await User.find(query)
            .select('-password') // Exclude password field
            .sort({ _id: 1 }) // Sort by _id ascending for consistent ordering
            .limit(limit);

        // Determine if there are more users to load
        let hasMore = false;
        if (users.length > 0) {
            const lastUser = users[users.length - 1];
            const nextUser = await User.findOne({
                _id: { $gt: lastUser._id },
                ...query
            }).select('_id');
            hasMore = !!nextUser;
        }

        // Prepare response for infinite scrolling
        const response = {
            users,
            hasMore, // Indicates whether more users are available
            lastId: users.length > 0 ? users[users.length - 1]._id : null
        };

        // Return success response
        sendResponse(res, 200, response);
        
    } catch (err) {
        console.log(err);
        sendResponse(res, 500, null, err.message);
    }
};