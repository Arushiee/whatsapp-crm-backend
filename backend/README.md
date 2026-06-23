# WhatsApp CRM Backend

This is a production-ready Node.js, Express, and MongoDB backend designed to power a WhatsApp CRM (similar to WATI, Interakt, or 11za). It includes JWT-based authentication, CRM contacts management, conversation logs, and real-time messaging using Socket.IO.

---

## Technical Stack
* **Node.js & Express.js** - Server framework
* **MongoDB & Mongoose** - Database and Object Modeling
* **JWT Authentication** - Secure endpoints
* **Socket.IO** - Real-time client messaging triggers
* **express-validator** - Input validation and sanitization

---

## Getting Started

### 1. Prerequisite Installations
* Node.js (v18+)
* MongoDB running locally or a MongoDB Atlas Connection String

### 2. Environment Configurations
Create a `.env` file in the root of the `backend/` directory (a template is provided in `.env`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/whatsapp-crm
JWT_SECRET=your_super_secret_jwt_key
```

### 3. Installation
Navigate into the backend directory and run:
```bash
npm install
```

### 4. Running the Server
* **Development Mode (with auto-reload)**:
  ```bash
  npm run dev
  ```
* **Production Mode**:
  ```bash
  npm start
  ```

---

## API Documentation Quick Reference

### Authentication Routing (`/auth`)
* `POST /auth/register` - Registers a new admin or agent.
* `POST /auth/login` - Authenticates credentials and returns a JWT token.

### Contacts Routing (`/contacts`)
* `GET /contacts` - Fetch all contacts (supports queries: `?leadStatus=new&tag=leads`).
* `GET /contacts/:id` - Fetch single contact details.
* `POST /contacts` - Create new contact.
* `PUT /contacts/:id` - Update contact fields (notes, tags, leadStatus, assignedAgent, etc.).
* `DELETE /contacts/:id` - Delete a contact.

### Messages Routing (`/messages`)
* `GET /messages/:contactId` - Retrieve the conversation history for a given contact.
* `POST /messages` - Send a message to a contact (sets lastMessage on contact and resets unread count).

---

## Frontend Integration Guide

Here is the exact React code to swap your frontend's mock data (`initialContacts`, `initialMessages`) with the real live backend.

### 1. Installing Frontend Clients
In your React app, ensure you have installed `axios` and `socket.io-client`:
```bash
npm install axios socket.io-client
```

### 2. Axios Configuration
Create an API utility file (e.g. `src/api.js`) to attach the JWT token automatically:
```javascript
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000', // Update to match your backend port
});

// Automatically inject JWT token into requests if user is authenticated
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
```

---

### 3. React Integration Examples

#### A. Load Contacts List
Replace the static state initialization:
```javascript
// BEFORE (Mock Data):
// const [contacts, setContacts] = useState(initialContacts);

// AFTER (Real Backend):
import React, { useState, useEffect } from 'react';
import API from './api';

function ContactList() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await API.get('/contacts');
        setContacts(response.data.data.contacts);
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching contacts');
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

  if (loading) return <div>Loading contacts...</div>;
  if (error) return <div>{error}</div>;

  return (
    <ul>
      {contacts.map((contact) => (
        <li key={contact._id}>
          {contact.name} - {contact.phone} [{contact.leadStatus}]
          <p>Last Message: {contact.lastMessage?.text || 'No messages yet'}</p>
        </li>
      ))}
    </ul>
  );
}
```

#### B. Load Messages for a Contact
When selecting a contact in the sidebar, fetch their conversation logs from the backend:
```javascript
// BEFORE (Mock Data):
// const [messages, setMessages] = useState(initialMessages);

// AFTER (Real Backend):
import React, { useState, useEffect } from 'react';
import API from './api';

function ChatWindow({ activeContactId }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!activeContactId) return;

    const fetchMessages = async () => {
      try {
        const response = await API.get(`/messages/${activeContactId}`);
        setMessages(response.data.data.messages);
      } catch (err) {
        console.error('Error fetching conversation:', err);
      }
    };

    fetchMessages();
  }, [activeContactId]);

  return (
    <div className="chat-history">
      {messages.map((msg) => (
        <div key={msg._id} className={`message-${msg.senderType}`}>
          <p>{msg.message}</p>
          <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  );
}
```

#### C. Send a New Message
Save a message to the database (which updates contact state and emits socket event):
```javascript
import React, { useState } from 'react';
import API from './api';

function MessageComposer({ activeContactId, onMessageSent }) {
  const [text, setText] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeContactId) return;

    try {
      const response = await API.post('/messages', {
        contactId: activeContactId,
        message: text,
        senderType: 'agent' // Message sent from backend CRM portal
      });
      
      const newSavedMessage = response.data.data.message;
      
      // Update local state in parent component (unless relying purely on WebSocket triggers)
      if (onMessageSent) {
        onMessageSent(newSavedMessage);
      }
      
      setText('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <form onSubmit={handleSend}>
      <input 
        type="text" 
        value={text} 
        onChange={(e) => setText(e.target.value)} 
        placeholder="Type a message..." 
      />
      <button type="submit">Send</button>
    </form>
  );
}
```

#### D. Update Customer Details Panel
Save fields changed in the customer details panel (status, assignee, notes, tags, followUpDate):
```javascript
import React, { useState } from 'react';
import API from './api';

function CustomerDetailsPanel({ contact, onContactUpdated }) {
  const [leadStatus, setLeadStatus] = useState(contact.leadStatus);
  const [notes, setNotes] = useState(contact.notes);
  const [followUpDate, setFollowUpDate] = useState(contact.followUpDate || '');

  const handleSaveDetails = async () => {
    try {
      const response = await API.put(`/contacts/${contact._id}`, {
        leadStatus,
        notes,
        followUpDate: followUpDate || null
      });

      const updatedContact = response.data.data.contact;
      
      if (onContactUpdated) {
        onContactUpdated(updatedContact);
      }
      
      alert('Details saved successfully!');
    } catch (err) {
      console.error('Failed to update details:', err);
    }
  };

  return (
    <div className="details-panel">
      <h3>Customer Details</h3>
      <select value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}>
        <option value="new">New</option>
        <option value="contacted">Contacted</option>
        <option value="qualified">Qualified</option>
        <option value="lost">Lost</option>
        <option value="won">Won</option>
      </select>

      <textarea 
        value={notes} 
        onChange={(e) => setNotes(e.target.value)} 
        placeholder="Customer notes..." 
      />

      <input 
        type="date" 
        value={followUpDate ? new Date(followUpDate).toISOString().substr(0,10) : ''} 
        onChange={(e) => setFollowUpDate(e.target.value)} 
      />

      <button onClick={handleSaveDetails}>Save Changes</button>
    </div>
  );
}
```

#### E. Setup Real-time WebSocket Listeners
Subscribe your chat window/sidebar to incoming/outgoing messages so the view updates in real time without refreshing:
```javascript
import { useEffect } from 'react';
import io from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://localhost:5000';

function useSocketIntegration(setContacts, setMessages, activeContactId) {
  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL);

    // Join a room based on the active contact conversation to avoid noise
    if (activeContactId) {
      socket.emit('join', activeContactId);
    }

    // Listen to the 'new-message' channel
    socket.on('new-message', (newMessage) => {
      console.log('Socket received new-message:', newMessage);

      // 1. Update active chat logs if the message belongs to the active conversation
      if (activeContactId && newMessage.contact.id === activeContactId) {
        setMessages((prevMessages) => {
          // Prevent duplicates
          if (prevMessages.some((m) => m._id === newMessage._id)) return prevMessages;
          return [...prevMessages, newMessage];
        });
      }

      // 2. Update contact list item last message & unread count
      setContacts((prevContacts) =>
        prevContacts.map((contact) => {
          if (contact._id === newMessage.contact.id) {
            return {
              ...contact,
              lastMessage: {
                text: newMessage.message,
                senderType: newMessage.senderType,
                timestamp: newMessage.timestamp,
              },
              unreadCount:
                newMessage.senderType === 'customer' && contact._id !== activeContactId
                  ? contact.unreadCount + 1
                  : contact.unreadCount,
            };
          }
          return contact;
        })
      );
    });

    // Clean up connections on unmount
    return () => {
      if (activeContactId) {
        socket.emit('leave', activeContactId);
      }
      socket.disconnect();
    };
  }, [activeContactId, setContacts, setMessages]);
}
```
