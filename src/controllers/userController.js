const User = require("../models/UserModel");
const { sendResponse } = require("../helpers/response");
const { Message } = require("../helpers/messages");
const bcrypt = require("bcrypt");

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
        if (!user) return sendResponse(res, 404, Message.USER_NOT_FOUND);

        // Check if user is active
        if (!user.isActive) return sendResponse(res, 403, Message.USER_INACTIVE);

        // Verify password
        const isPasswordValid = await bcrypt.compare(password?.trim(), user.password);
        if (!isPasswordValid) return sendResponse(res, 401, Message.INVALID_CREDENTIALS);

        // You might want to generate a token here for authentication
        // const token = generateAuthToken(user);

        // Return success response with user data (excluding password)
        const userData = {
            
            _id:  user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            mobile: user.mobile,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified
            // token: token // Include if you're generating a token
        };

        sendResponse(res, 200, Message.LOGIN_SUCCESS, userData);
        
    } catch (err) {
        console.log(err);
        sendResponse(res, 500, null, err.message);
    }
};