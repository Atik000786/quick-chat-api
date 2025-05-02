const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET;

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    const clients = new Map();

    wss.on('connection', (ws, req) => {
        // Extract token from query parameters
        const token = req.url.split('token=')[1];

        if (!token) {
            ws.close(1008, 'Authentication failed: No token provided');
            return;
        }

        try {
            // Verify JWT token
            const decoded = jwt.verify(token, secretKey);
            const userId = decoded.userId;

            // Store the connection with user ID
            clients.set(userId.toString(), ws);

            // Send online status to relevant users
            broadcastOnlineStatus(userId.toString(), true);

            ws.on('message', (message) => {
                // Handle incoming messages if needed
                console.log(`Received message from ${userId}: ${message}`);
            });

            ws.on('close', () => {
                clients.delete(userId.toString());
                broadcastOnlineStatus(userId.toString(), false);
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error for user ${userId}:`, error);
            });

        } catch (error) {
            console.error('WebSocket authentication error:', error);
            ws.close(1008, 'Authentication failed: Invalid token');
        }
    });

    function broadcastOnlineStatus(userId, isOnline) {
        // Notify all connected clients about the status change
        clients.forEach((client, clientId) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'statusUpdate',
                    userId,
                    isOnline
                }));
            }
        });
    }

    return wss;
}

module.exports = setupWebSocket;