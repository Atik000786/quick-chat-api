const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const app = express();
const cors = require("cors");
const bodyParser = require('body-parser');
const morgan = require("morgan");
const router = require('./router');
const port = process.env.PORT || 9000;
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Create HTTP server for WebSocket integration
const httpServer = require("http").createServer(app);

// Initialize Socket.IO with proper configuration
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Store connected users
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Authenticate via JWT
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  
  if (!token) {
    socket.disconnect(true);
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId.toString();
    
    // Join user to their own room
    socket.join(userId);
    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} connected with socket ${socket.id}`);

    // Notify others about online status
    socket.broadcast.emit('user-online', { userId });

    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      socket.broadcast.emit('user-offline', { userId });
      console.log(`User ${userId} disconnected`);
    });

    // Handle custom events
    socket.on('typing', (data) => {
      io.to(data.receiverId).emit('typing-indicator', {
        senderId: userId,
        isTyping: data.isTyping
      });
    });

  } catch (err) {
    console.error('Socket authentication error:', err);
    socket.disconnect(true);
  }
});

// Make io accessible in routes
app.set('io', io);

// Database connection
async function connectDB() {
    try {
        await mongoose.connect(process.env.DB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("MongoDB Connected");
        
        // Set up change streams for real-time updates
        if (process.env.ENABLE_MONGO_CHANGE_STREAMS === 'true') {
            setupChangeStreams();
        }
    } catch (err) {
        console.error("MongoDB Connection Error:", err);
        process.exit(1);
    }
}

// MongoDB Change Streams
function setupChangeStreams() {
    const messageCollection = mongoose.connection.collection('messages');
    const changeStream = messageCollection.watch();
    
    changeStream.on('change', (change) => {
        if (change.operationType === 'insert') {
            const message = change.fullDocument;
            io.to(message.receiver.toString()).emit('new-message', message);
        } else if (change.operationType === 'update') {
            // Handle message status updates (read/delivered)
            const updatedFields = change.updateDescription.updatedFields;
            if (updatedFields.status) {
                io.to(change.documentKey._id.toString()).emit('message-status', {
                    messageId: change.documentKey._id,
                    status: updatedFields.status
                });
            }
        }
    });
    
    console.log("MongoDB Change Streams enabled");
}

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(bodyParser.json({ limit: '500mb' }));
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('dev'));

// Routes
app.use('/api/v1', router);

// Health check endpoint
app.get('/health', (req, res) => {
    const websocketStatus = io.engine.clientsCount > 0 ? 'active' : 'inactive';
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        websocket: websocketStatus,
        connections: io.engine.clientsCount,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
httpServer.listen(port, async () => {
    try {
        await connectDB();
        console.log(`Server listening on Port ==> http://localhost:${port}/`);
        console.log(`WebSocket server running on ws://localhost:${port}`);
    } catch (err) {
        console.error(`Server startup error ===> ${err}`);
        process.exit(1);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        io.close(() => {
            console.log('WebSocket server closed');
            httpServer.close(() => {
                console.log('HTTP server stopped');
                process.exit(0);
            });
        });
    } catch (err) {
        console.error('Shutdown error:', err);
        process.exit(1);
    }
});