const jwt = require("jsonwebtoken");
const { sendResponse } = require("../helpers/response");
const User = require("../models/UserModel");
const { Message } = require("../helpers/messages");
const secretKey = process.env.SECRET_KEY;

exports.GenerateToken = (id) => {

    try {
        
        const token = jwt.sign({ id: id }, secretKey, { expiresIn: '12h' });
        return token;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

exports.ValidateToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization;
        
        // Check if token exists
        if (!token) {
            return sendResponse(res, 401, null, Message.TOKEN_MISSING);
        }

        // Verify token
        const decodedToken = jwt.verify(token, secretKey);

        // Find user by ID and select specific fields
        const user = await User.findById(decodedToken.id).select(
            "_id firstName lastName email mobile isActive isEmailVerified isMobileVerified"
        );

        // If user not found
        if (!user) {
            return sendResponse(res, 401, null, Message.USER_NOT_FOUND);
        }

        // Check if user is active
        if (!user.isActive) {
            return sendResponse(res, 403, null, Message.ACCOUNT_INACTIVE);
        }

        // Attach user data to request
        req.user = user;
        next();
    } catch (err) {
        console.error("Authentication Error:", err);
        
        // Handle different JWT error cases
        if (err.name === 'TokenExpiredError') {
            return sendResponse(res, 401, null, Message.TOKEN_EXPIRED);
        } else if (err.name === 'JsonWebTokenError') {
            return sendResponse(res, 401, null, Message.INVALID_TOKEN);
        }
        
        return sendResponse(res, 500, null, Message.SERVER_ERROR);
    }
};