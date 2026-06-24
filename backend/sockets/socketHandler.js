let io;

module.exports = {
  init: (server) => {
    const { Server } = require('socket.io');
    io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      console.log(`[Socket.IO] Client connected: ${socket.id}`);

      socket.on('join', (roomName) => {
        socket.join(roomName);
        console.log(`[Socket.IO] Socket ${socket.id} joined room: ${roomName}`);
      });

      socket.on('leave', (roomName) => {
        socket.leave(roomName);
        console.log(`[Socket.IO] Socket ${socket.id} left room: ${roomName}`);
      });

      socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) throw new Error('Socket.IO is not initialized! Call init first.');
    return io;
  },

  // Existing — new message in a conversation
  emitNewMessage: (message) => {
    if (!io) {
      console.warn('[Socket.IO] Warning: Socket.IO not initialized yet.');
      return;
    }
    io.emit('new-message', message);
    if (message.conversationId) {
      io.to(message.conversationId.toString()).emit('new-message', message);
    }
    if (message.contact && message.contact.id) {
      io.to(message.contact.id.toString()).emit('new-message', message);
    }
    console.log(`[Socket.IO] Broadcasted 'new-message' for Conversation: ${message.conversationId}`);
  },

  // NEW — a fresh conversation just entered the queue
  emitQueueUpdate: (data) => {
    if (!io) return;
    io.emit('queue-updated', data);
    console.log(`[Socket.IO] Broadcasted 'queue-updated' for contact: ${data.contactId}`);
  },

  // NEW — a conversation was assigned to an agent (moves out of queue)
  emitConversationAssigned: (data) => {
    if (!io) return;
    io.emit('conversation-assigned', data);
    console.log(`[Socket.IO] Broadcasted 'conversation-assigned' for: ${data.conversationId}`);
  },
};