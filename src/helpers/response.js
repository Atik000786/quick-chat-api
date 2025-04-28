function sendResponse(res, statusCode, data, msg) {
    let success = true;
    let message = "";

    switch (statusCode) {
        
        case 200:
            code = 200;
            success = true;
            message = msg || "OK";
            break;
        case 201:
            code = 201;
            success = true;
            message = msg || "Created";
            break;
        case 204:
            code = 204;
            success = true;
            message = "No Content";
            break;
        case 400:
            code = 400;
            success = false;
            message = msg || "Bad Request";
            break;
        case 401:
            code = 401;
            success = false;
            message = "Unauthorized";
            break;
        case 403:
            code = 403;
            success = false;
            message = "Forbidden";
            break;
        case 404:
            code = 404;
            success = false;
            message = msg || "Not Found";
            break;
        case 500:
            code = 500;
            success = false;
            message = msg || 'Internal Server Error';
            break;
        default:
            code = 500
            success = false;
            message = "";
    }

    if (message !== "") {
        res.status(statusCode).json({ success: success, status: code, message: message, data: data });
    } else {
        res.status(statusCode).json(data);
    }
}
module.exports = { sendResponse };