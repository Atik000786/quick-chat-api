const jwt = require("jsonwebtoken");
const { sendResponse } = require("../helpers/response");
const User = require("../models/UserModel");
const { Message } = require("../helpers/messages");
const secretKey = process.env.JWT_SECRET;

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
        let isUser = false;
        const token = req.headers.authorization;
        
        // Check if token exists
        if (!token) {
            return sendResponse(res, 401, null, Message.TOKEN_MISSING);
        }

        // Verify token
        const decodedToken = jwt.verify(token, secretKey);

        // Try to find user as Student first
        let user = await User.findById(decodedToken.id).select(
            "_id name mobile email type isActive isEmailVerified isMobileVerified"
        );

        // If not found as Student, try as User
        if (!user) {
            user = await User.findById(decodedToken.id).select(
                "_id firstName lastName email mobile isActive isEmailVerified isMobileVerified"
            );
            isUser = true;
        }

        // If user not found in either collection
        if (!user) {
            return sendResponse(res, 401, null, Message.USER_NOT_FOUND);
        }

        // Check if user is active
        if (!user.isActive) {
            return sendResponse(res, 403, null, Message.ACCOUNT_INACTIVE);
        }

        // Attach user data to request with isUser flag
        req.user = user;
        req.user.isUser = isUser;
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