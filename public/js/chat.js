// public/js/chat.js
const socket = io();

// UI refs
const privateTab = document.getElementById('private-tab');
const groupTab = document.getElementById('group-tab');
const privateChat = document.getElementById('private-chat');
const groupChat = document.getElementById('group-chat');

const contactsEl = document.getElementById('contacts');
const myGroupsEl = document.getElementById('my-groups');
const allGroupsEl = document.getElementById('all-groups');

const privateHistory = document.getElementById('private-history');
const groupHistory = document.getElementById('group-history');

const privateTyping = document.getElementById('private-typing');
const groupTyping = document.getElementById('group-typing');

const privateMsgInput = document.getElementById('private-message');
const sendPrivateBtn = document.getElementById('send-private');

const groupMsgInput = document.getElementById('group-message');
const sendGroupBtn = document.getElementById('send-group');
const createGroupBtn = document.getElementById('create-group-btn');

let currentPrivateRoom = null;
let currentGroupRoom = null;
let currentMode = 'private';
let typingTimeout;

// --- Tab switching ---
privateTab.addEventListener('click', () => {
  privateTab.classList.add('active');
  groupTab.classList.remove('active');
  privateChat.classList.remove('hidden');
  groupChat.classList.add('hidden');
  currentMode = 'private';
});
groupTab.addEventListener('click', () => {
  groupTab.classList.add('active');
  privateTab.classList.remove('active');
  groupChat.classList.remove('hidden');
  privateChat.classList.add('hidden');
  currentMode = 'group';
});

// --- Announce online & request groups ---
if (CURRENT_USER && CURRENT_USER._id) {
  socket.emit('user_online', {
    _id: CURRENT_USER._id,
    name: CURRENT_USER.name || '',
    profilePic: CURRENT_USER.profilePic 
  });

  socket.emit('request_groups');
}

// --- Render online users ---
socket.on('online_users', (users) => {
  contactsEl.innerHTML = '';
  users.forEach(u => {
    if (!u || String(u._id) === String(CURRENT_USER._id)) return;
    const li = document.createElement('li');
    li.className = 'contact';
    li.dataset.userid = u._id;
    li.innerHTML = `
      <img src="${u.profilePic}" class="avatar">
      <span class="contact-name">${u.name || u._id}</span>
    `;
    li.addEventListener('click', () => openPrivateChat(u._id));
    contactsEl.appendChild(li);
  });
});

// --- Render groups ---
socket.on('groups_list', (groups) => {
  myGroupsEl.innerHTML = '';
  allGroupsEl.innerHTML = '';

  (groups || []).forEach(g => {
    const li = document.createElement('li');
    li.className = 'group-item';
    li.dataset.groupid = g._id;
    li.textContent = g.name;

    const isMember = Array.isArray(g.members) && g.members.map(String).includes(String(CURRENT_USER._id));
    if (isMember) {
      li.addEventListener('click', () => joinGroup(g._id));
      myGroupsEl.appendChild(li);
    } else {
      const joinBtn = document.createElement('button');
      joinBtn.className = 'small-join-btn';
      joinBtn.textContent = 'Join';
      joinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        joinGroup(g._id);
      });
      li.appendChild(joinBtn);
      allGroupsEl.appendChild(li);
    }
  });
});

// --- New group created ---
socket.on('group_created', () => socket.emit('request_groups'));

// --- Open private chat ---
function openPrivateChat(otherUserId) {
  sendPrivateBtn.disabled = true;
  privateHistory.innerHTML = '';
  socket.emit('join_private', { myId: CURRENT_USER._id, otherUserId });

  const onJoined = ({ roomId, type }) => {
    if (type !== 'private') return;
    currentPrivateRoom = roomId;
    sendPrivateBtn.disabled = false;
    socket.off('joined_room', onJoined);
  };
  socket.on('joined_room', onJoined);
}

// --- Join group ---
function joinGroup(groupId) {
  if (!groupId) return;
  groupTab.click();
  sendGroupBtn.disabled = true;
  groupHistory.innerHTML = '';
  socket.emit('join_group', { groupId });

  const onJoined = ({ roomId, type }) => {
    if (type !== 'group' || String(roomId) !== String(groupId)) return;
    currentGroupRoom = roomId;
    sendGroupBtn.disabled = false;
    socket.off('joined_room', onJoined);
  };
  socket.on('joined_room', onJoined);
}

// --- Render chat history ---
socket.on('chat_history', ({ roomId, history }) => {
  let dest = (String(roomId) === String(currentPrivateRoom)) ? privateHistory
           : (String(roomId) === String(currentGroupRoom)) ? groupHistory
           : null;
  if (!dest) {
    dest = String(roomId).includes('_') ? privateHistory : groupHistory;
  }

  dest.innerHTML = '';
  (history || []).forEach(msg => renderMessage(msg, dest));
  dest.scrollTop = dest.scrollHeight;
});

// --- Receive a single new message ---
socket.on('receive_message', (msg) => {
  const dest = (String(msg.roomId) === String(currentPrivateRoom)) ? privateHistory
             : (String(msg.roomId) === String(currentGroupRoom)) ? groupHistory
             : null;
  if (!dest) return;
  renderMessage(msg, dest);
});

// --- Typing indicator ---
socket.on('typing', ({ userId, username }) => {
  if (userId === CURRENT_USER._id) return;
  const target = currentMode === 'private' ? privateTyping : groupTyping;
  target.innerText = `${username} is typing...`;
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => target.innerText = '', 2000);
});

// --- Send typing event ---
[privateMsgInput, groupMsgInput].forEach(inp => {
  inp.addEventListener('input', () => {
    const roomId = currentMode === 'private' ? currentPrivateRoom : currentGroupRoom;
    if (!roomId) return;
    socket.emit('typing', { roomId, userId: CURRENT_USER._id, username: CURRENT_USER.name });
  });
});

// --- Send messages ---
sendPrivateBtn.addEventListener('click', () => {
  const text = privateMsgInput.value.trim();
  if (!text || !currentPrivateRoom) return;
  socket.emit('send_message', { roomId: currentPrivateRoom, text });
  privateMsgInput.value = '';
});
sendGroupBtn.addEventListener('click', () => {
  const text = groupMsgInput.value.trim();
  if (!text || !currentGroupRoom) return;
  socket.emit('send_message', { roomId: currentGroupRoom, text });
  groupMsgInput.value = '';
});

// --- Enter key sends ---
[privateMsgInput, groupMsgInput].forEach(inp => {
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inp === privateMsgInput ? sendPrivateBtn.click() : sendGroupBtn.click();
    }
  });
});

// --- Create group ---
createGroupBtn.addEventListener('click', () => {
  const name = prompt('Enter group name:');
  if (!name || !name.trim()) return;
  socket.emit('create_group', { name: name.trim() });
});

// --- Render a message ---
function renderMessage(msg, containerEl) {
  const isMe = String(msg.sender && (msg.sender._id || msg.sender)) === String(CURRENT_USER._id);

  const wrapper = document.createElement('div');
  wrapper.className = 'message-row ' + (isMe ? 'me' : 'other');

  if (!isMe) {
    const avatar = document.createElement('img');
    avatar.className = 'avatar-small';
    avatar.src = (msg.sender && msg.sender.profilePic) ? msg.sender.profilePic : '/images/default-avatar.png';
    avatar.alt = (msg.sender && msg.sender.name) ? msg.sender.name : '';
    wrapper.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble ' + (isMe ? 'me-bubble' : 'other-bubble');
  bubble.textContent = msg.text || '';
  bubble.dataset.msgid = msg._id; // Keep track of message ID
  bubble.dataset.timestamp = msg.createdAt || Date.now();

  // 👇 Long press detection for edit/delete
  if (isMe) {
    let pressTimer;
    bubble.addEventListener('mousedown', () => {
      pressTimer = setTimeout(() => showMessageOptions(bubble, msg), 5000); // 5 sec hold
    });
    bubble.addEventListener('mouseup', () => clearTimeout(pressTimer));
    bubble.addEventListener('mouseleave', () => clearTimeout(pressTimer));
  }

  wrapper.appendChild(bubble);
  containerEl.appendChild(wrapper);
  containerEl.scrollTop = containerEl.scrollHeight;
}

// --- Show options for edit/delete ---
function showMessageOptions(bubble, msg) {
  const now = Date.now();
  const sentAt = new Date(bubble.dataset.timestamp).getTime();
  const diffMinutes = (now - sentAt) / (1000 * 60);

  const menu = document.createElement('div');
  menu.className = 'msg-options';
  menu.style.position = 'absolute';
  menu.style.background = '#fff';
  menu.style.border = '1px solid #ccc';
  menu.style.padding = '5px';
  menu.style.zIndex = 1000;

  const rect = bubble.getBoundingClientRect();
  menu.style.top = rect.bottom + 'px';
  menu.style.left = rect.left + 'px';

  // Edit option (only if within 30 mins)
  if (diffMinutes <= 30) {
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit Message';
    editBtn.onclick = () => {
      const newText = prompt('Edit your message:', msg.text);
      if (newText && newText.trim()) {
        socket.emit('edit_message', { msgId: msg._id, newText });
      }
      document.body.removeChild(menu);
    };
    menu.appendChild(editBtn);
  }

  // Delete option
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete Message';
  deleteBtn.onclick = () => {
    if (confirm('Delete this message?')) {
      socket.emit('delete_message', { msgId: msg._id });
    }
    document.body.removeChild(menu);
  };
  menu.appendChild(deleteBtn);

  document.body.appendChild(menu);

  // Close on click elsewhere
  document.addEventListener('click', function handler(e) {
    if (!menu.contains(e.target)) {
      document.body.removeChild(menu);
      document.removeEventListener('click', handler);
    }
  });
}

// --- Listen for edits & deletes ---
socket.on("message_edited", (msg) => {
  const bubble = document.querySelector(`[data-id="${msg._id}"] .msg-bubble`);
  if (bubble) bubble.textContent = msg.text + " (edited)";
});

socket.on("message_deleted", ({ messageId }) => {
  const wrapper = document.querySelector(`[data-id="${messageId}"]`);
  if (wrapper) wrapper.remove();
});

