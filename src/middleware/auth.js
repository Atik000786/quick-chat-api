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
        // 1. Extract token from Authorization header
        const authHeader = req.headers.authorization;
        
        // 2. Check if token exists in the expected format
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendResponse(res, 401, null, Message.TOKEN_MISSING);
        }

        // 3. Extract the token from the header
        const token = authHeader.split(' ')[1];
        
        // 4. Verify the token
        const decodedToken = jwt.verify(token, secretKey);

        // 5. Validate token structure
        if (!decodedToken.userId) {
            return sendResponse(res, 401, null, Message.INVALID_TOKEN_FORMAT);
        }

        // 6. Find user in database
        const user = await User.findById(decodedToken.userId).select(
            "_id firstName lastName email mobile isActive isEmailVerified isMobileVerified"
        );

        // 7. Check if user exists
        if (!user) {
            return sendResponse(res, 401, null, Message.USER_NOT_FOUND);
        }

        // 8. Check if account is active
        if (!user.isActive) {
            return sendResponse(res, 403, null, Message.ACCOUNT_INACTIVE);
        }

        // 9. Attach user to request object
        req.user = {
            userId: user._id,
            email: user.email,
            mobile: user.mobile,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified
        };

        // 10. Proceed to the next middleware/route handler
        next();
    } catch (err) {
        console.error("Authentication Error:", err);
        
        // Handle specific JWT errors
        if (err.name === 'TokenExpiredError') {
            return sendResponse(res, 401, null, Message.TOKEN_EXPIRED);
        }
        if (err.name === 'JsonWebTokenError') {
            return sendResponse(res, 401, null, Message.INVALID_TOKEN);
        }
        
        // Generic server error
        return sendResponse(res, 500, null, Message.SERVER_ERROR);
    }
};