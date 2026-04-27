require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", "https://team-flow-a3l5.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Admin API ---
// Route to create a new user (Admin only)
app.post('/api/admin/create-user', async (req, res) => {
  const { email, password, fullName, role, teamId } = req.body;
  
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name: fullName, 
        role: role || 'member',
        team_id: teamId 
      }
    });

    if (error) throw error;
    res.status(200).json({ message: 'User created successfully', user: data.user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to delete a user (Admin only)
app.post('/api/admin/delete-user', async (req, res) => {
  const { userId } = req.body;
  
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- Socket.IO Signaling & Chat ---
const users = {}; // Map socket.id to user info

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, userId, userName }) => {
    socket.join(roomId);
    users[socket.id] = { userId, userName, roomId };
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', { userId, userName, socketId: socket.id });
    
    console.log(`${userName} joined room: ${roomId}`);
  });

  // Chat messaging
  socket.on('send-message', ({ roomId, message }) => {
    // Broadcast message to the room including sender (or sender can add locally)
    io.to(roomId).emit('receive-message', message);
  });

  // WebRTC Signaling
  socket.on('offer', ({ to, offer }) => {
    socket.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    socket.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // Meeting Notifications
  socket.on('start-call', ({ roomId, userName }) => {
    socket.to(roomId).emit('incoming-call', { roomId, from: userName });
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      socket.to(user.roomId).emit('user-left', { userId: user.userId, socketId: socket.id });
      delete users[socket.id];
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
