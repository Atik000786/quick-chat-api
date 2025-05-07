const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const router = require('./router');
const port = process.env.PORT || 9000;
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const httpServer = require('http').createServer(app);

// Configure CORS for both HTTP and WebSocket
const allowedOrigins = [
  process.env.CLIENT_URL,
    'http://localhost:3001' // For local development
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

const io = new Server(httpServer, {
  cors: corsOptions,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

const connectedUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId.toString();
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}, User: ${socket.userId}`);

  socket.join(socket.userId);
  connectedUsers.set(socket.userId, socket.id);
  socket.broadcast.emit('user-online', { userId: socket.userId });

  socket.on('typing', (data) => {
    io.to(data.receiverId).emit('typing-indicator', {
      senderId: socket.userId,
      isTyping: data.isTyping,
    });
  });

  socket.on('markAsRead', ({ senderId, receiverId }) => {
    io.to(senderId).emit('messageStatus', {
      messageId: 'all',
      status: 'read',
    });
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.userId);
    socket.broadcast.emit('user-offline', { userId: socket.userId });
    console.log(`User ${socket.userId} disconnected`);
  });
});

app.set('io', io);

async function connectDB() {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');

    if (process.env.ENABLE_MONGO_CHANGE_STREAMS === 'true') {
      setupChangeStreams();
    }
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  }
}

function setupChangeStreams() {
  const messageCollection = mongoose.connection.collection('messages');
  const changeStream = messageCollection.watch();

  changeStream.on('change', (change) => {
    if (change.operationType === 'insert') {
      const message = change.fullDocument;
      io.to(message.receiver.toString()).emit('newMessage', message);
    } else if (change.operationType === 'update') {
      const updatedFields = change.updateDescription.updatedFields;
      if (updatedFields.status) {
        io.to(change.documentKey._id.toString()).emit('messageStatus', {
          messageId: change.documentKey._id,
          status: updatedFields.status,
        });
      }
    }
  });

  console.log('MongoDB Change Streams enabled');
}

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(bodyParser.json({ limit: '500mb' }));
app.use(cors(corsOptions));
app.use(morgan('dev'));

app.use('/api/v1', router);

app.get('/health', (req, res) => {
  const websocketStatus = io.engine.clientsCount > 0 ? 'active' : 'inactive';
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    websocket: websocketStatus,
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

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