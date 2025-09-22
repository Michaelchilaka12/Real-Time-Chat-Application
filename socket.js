// socket.js
const User = require('./models/userModel');
const Message = require('./models/messageModel');
const Group = require('./models/groupModel');

const onlineUsers = new Map(); // userId -> { sockets: Set(socketId), name, photo }

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log('⚡ socket connected', socket.id);
    
    // --- send groups on demand ---
    socket.on('request_groups', async () => {
      const groups = await Group.find().lean();
      socket.emit('groups_list', groups);
    });

    // --- user announces they're online ---
    socket.on('user_online', async (userObj) => {
      try {
        if (!userObj || !userObj._id) return;
        const uid = String(userObj._id);

        socket.userId = uid;
        socket.userName = userObj.name || '';
        socket.userProfilePic = userObj.profilePic || '';

        if (!onlineUsers.has(uid)) {
          onlineUsers.set(uid, { sockets: new Set(), name: socket.userName, profilePic: socket.userProfilePic });
        }
        onlineUsers.get(uid).sockets.add(socket.id);

        try { await User.findByIdAndUpdate(uid, { online: true }).exec(); } catch (e) {}

        const onlineArr = Array.from(onlineUsers.entries()).map(([k, v]) => ({ _id: k, name: v.name, profilePic: v.profilePic }));
        io.emit('online_users', onlineArr);

        const groups = await Group.find().lean();
        socket.emit('groups_list', groups);
      } catch (err) {
        console.error('user_online error', err);
      }
    });

    // --- join private chat ---
    socket.on('join_private', async ({ myId, otherUserId }) => {
      try {
        if (!myId || !otherUserId) return;
        const roomId = [String(myId), String(otherUserId)].sort().join('_');
        socket.join(roomId);

        socket.emit('joined_room', { roomId, type: 'private', otherUserId });

        const history = await Message.find({ roomId })
          .populate('sender', 'name profilePic')
          .sort({ createdAt: 1 })
          .lean();

        socket.emit('chat_history', { roomId, history });
        console.log(`user ${myId} joined private room ${roomId}`);
      } catch (err) {
        console.error('join_private error', err);
      }
    });

    // --- create group ---
socket.on('create_group', async ({ name }) => {
  try {
    if (!name || !socket.userId) return;

    // create group with current user as member
    const newGroup = await Group.create({
      name: name.trim(),
      members: [socket.userId],
      createdBy: socket.userId
    });

    // refresh groups for everyone
    const groups = await Group.find().lean();
    io.emit('groups_list', groups);

    // notify creator only
    socket.emit('create_group_success', newGroup);

    console.log(`✅ Group created: ${newGroup.name} by ${socket.userId}`);
  } catch (err) {
    console.error('create_group error', err);
    socket.emit('error_message', 'Failed to create group');
  }
});



    // --- join group ---
    socket.on('join_group', async ({ groupId }) => {
      try {
        if (!groupId || !socket.userId) return;

        const group = await Group.findById(groupId);
        if (!group) return socket.emit('error_message', 'Group not found');

        if (!group.members.some(m => String(m) === String(socket.userId))) {
          group.members.push(socket.userId);
          await group.save();
        }

        socket.join(groupId);

        const groups = await Group.find().lean();
        io.emit('groups_list', groups);

        socket.emit('joined_room', { roomId: groupId, type: 'group', groupId });

        const history = await Message.find({ roomId: groupId })
          .populate('sender', 'name profilePic')
          .sort({ createdAt: 1 })
          .lean();

        socket.emit('chat_history', { roomId: groupId, history });
        console.log(`${socket.userId} joined group ${groupId}`);
      } catch (err) {
        console.error('join_group error', err);
      }
    });

    // --- send message ---
    socket.on('send_message', async ({ roomId, text }) => {
      try {
        if (!roomId || !text || !socket.userId) return;

        const newMessage = await Message.create({
          roomId,
          sender: socket.userId,
          text: text.trim()
        });

        const populated = await Message.findById(newMessage._id)
          .populate('sender', 'name profilePic')
          .lean();

        io.to(roomId).emit('receive_message', populated);
      } catch (err) {
        console.error('send_message error', err);
      }
    });

    // --- typing event ---
    socket.on('typing', ({ roomId, userId, username }) => {
      socket.to(roomId).emit('typing', { userId, username });
    });

    // server.js
socket.on("edit_message", async ({ messageId, newText }) => {
  const msg = await Message.findById(messageId);
  if (!msg) return;

  const isSender = String(msg.sender) === String(socket.user._id);
  const within30min = (Date.now() - msg.createdAt.getTime()) <= 30 * 60 * 1000;

  if (isSender && within30min) {
    msg.text = newText;
    await msg.save();
    io.to(msg.roomId).emit("message_edited", msg);
  }
});

socket.on("delete_message", async ({ messageId }) => {
  const msg = await Message.findById(messageId);
  if (!msg) return;

  if (String(msg.sender) === String(socket.user._id)) {
    await msg.deleteOne();
    io.to(msg.roomId).emit("message_deleted", { messageId });
  }
});


    // --- disconnect cleanup ---
    socket.on('disconnect', async () => {
      try {
        if (socket.userId) {
          const info = onlineUsers.get(socket.userId);
          if (info) {
            info.sockets.delete(socket.id);
            if (info.sockets.size === 0) {
              onlineUsers.delete(socket.userId);
              try { await User.findByIdAndUpdate(socket.userId, { online: false }).exec(); } catch (e) {}
            } else {
              onlineUsers.set(socket.userId, info);
            }
          }
          const onlineArr = Array.from(onlineUsers.entries()).map(([k, v]) => ({ _id: k, name: v.name, profilePic: v.profilePic }));
          io.emit('online_users', onlineArr);
        }
        console.log('❌ socket disconnected', socket.id);
      } catch (err) {
        console.error('disconnect cleanup error', err);
      }
    });
  });
}

module.exports = socketHandler;
