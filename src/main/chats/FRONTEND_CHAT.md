# Rhisya — Private Chat API Reference

> **Version**: 1.0.0 | **Last Updated**: 2026-05-22 | **Protocol**: HTTP REST + Socket.IO WebSocket

Complete frontend integration guide for the Rhisya private messaging system. This system enables **1-to-1 private chats between Users and Providers only** — user-to-user and provider-to-provider chats are **not allowed**. Admins can chat with anyone.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Authentication](#authentication)
- [HTTP REST API Endpoints](#http-rest-api-endpoints)
- [WebSocket Connection](#websocket-connection)
- [WebSocket Events Reference](#websocket-events-reference)
- [Detailed Event Payloads](#detailed-event-payloads)
- [TypeScript Interfaces](#typescript-interfaces)
- [Complete Integration Example](#complete-integration-example)
- [Message Flow Diagrams](#message-flow-diagrams)
- [Important Notes](#important-notes)

---

## Architecture Overview

| Component | Technology | Purpose |
|---|---|---|
| Real-time messaging | Socket.IO (`/chat` namespace) | Bi-directional WebSocket events for sending/receiving messages, typing indicators, presence |
| REST API | NestJS HTTP (`/private-messages`) | Standard CRUD for chats, messages, unread counts |
| Authentication | JWT (Passport) | Bearer token required for both HTTP and WebSocket |
| User Presence & Typing | Redis (ioredis) | Online/offline status, typing indicators with TTL auto-expiry |
| Message Persistence | PostgreSQL (Prisma ORM) | LiveChat, LiveMessage, LiveMessageRead, LiveChatParticipant models |
| Role Enforcement | Server-side guard | Only `USER ↔ PROVIDER` chats are permitted |

---

## Authentication

### HTTP Requests

Include the JWT access token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_access_token>
```

### WebSocket Connection

Pass the token via the `auth` object or `Authorization` header in the Socket.IO handshake:

```javascript
const socket = io('http://your-api-url/chat', {
  auth: {
    token: 'Bearer <your_jwt_access_token>',
  },
});
```

### WebSocket Authentication Error Codes

These error codes are returned via the `connect_error` event:

| Error Code | Description |
|---|---|
| `MISSING_AUTH_HEADER` | No authorization header or `auth.token` provided |
| `INVALID_OR_EMPTY_TOKEN` | Token string is empty or malformed |
| `SERVER_CONFIG_ERROR` | Server-side JWT secret is not configured |
| `TOKEN_EXPIRED` | JWT token has expired — request a new access token |
| `INVALID_TOKEN_SIGNATURE` | JWT signature verification failed |
| `TOKEN_VERIFICATION_FAILED` | Generic JWT verification error |
| `MISSING_USER_ID` | Token payload missing `sub` claim (user ID) |
| `USER_NOT_FOUND` | User ID from token not found in database |
| `AUTH_FAILED` | Generic authentication failure |

```javascript
socket.on('connect_error', (err) => {
  // err.message will be one of the error codes above
  switch (err.message) {
    case 'TOKEN_EXPIRED':
      // Refresh your access token and reconnect
      break;
    case 'MISSING_AUTH_HEADER':
      // Redirect to login
      break;
    default:
      console.error('Auth error:', err.message);
  }
});
```

---

## HTTP REST API Endpoints

**Base URL**: `/private-messages`  
**Guard**: `JwtAuthGuard` (all endpoints require a valid JWT)

---

### `POST` /private-messages/start

**Start or retrieve an existing 1-to-1 chat.**

If a chat already exists between the two users, it returns the existing chat. Otherwise, creates a new one.

**Request Body:**

```json
{
  "otherUserId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `otherUserId` | UUID string | ✅ | Auth ID of the user to chat with |

**Success Response** `200/201`:

```json
{
  "id": "chat-uuid",
  "type": "INDIVIDUAL",
  "createdAt": "2026-05-06T10:00:00.000Z",
  "updatedAt": "2026-05-06T10:00:00.000Z",
  "participants": [
    {
      "id": "participant-uuid",
      "chatId": "chat-uuid",
      "userId": "your-auth-id",
      "joinedAt": "2026-05-06T10:00:00.000Z",
      "user": {
        "id": "your-auth-id",
        "email": "user@example.com",
        "role": "USER",
        "isVerified": true,
        "name": "John Doe",
        "profilePhoto": "https://example.com/body-photo.jpg"
      }
    },
    {
      "id": "participant-uuid-2",
      "chatId": "chat-uuid",
      "userId": "provider-auth-id",
      "joinedAt": "2026-05-06T10:00:00.000Z",
      "user": {
        "id": "provider-auth-id",
        "email": "provider@example.com",
        "role": "PROVIDER",
        "isVerified": true,
        "name": "Dr. Smith",
        "profilePhoto": "https://example.com/profile-image.jpg"
      }
    }
  ],
  "messages": []
}
```

**Error Responses:**

| Status | Message | Reason |
|---|---|---|
| `401` | Unauthorized | Missing or invalid JWT |
| `403` | Chats are only allowed between a user and a provider | USER↔USER or PROVIDER↔PROVIDER attempted |
| `404` | One or both users not found | Invalid `otherUserId` |

---

### `GET` /private-messages/my-chats

**Get all chats for the authenticated user** with last message and unread count.

**Success Response** `200`:

```json
[
  {
    "id": "chat-uuid",
    "type": "INDIVIDUAL",
    "createdAt": "2026-05-06T10:00:00.000Z",
    "updatedAt": "2026-05-06T12:00:00.000Z",
    "unreadCount": 3,
    "otherUser": {
      "id": "provider-auth-id",
      "email": "provider@example.com",
      "role": "PROVIDER",
      "isVerified": true,
      "name": "Dr. Smith",
      "profilePhoto": "https://example.com/profile-image.jpg"
    },
    "lastMessage": {
      "id": "msg-uuid",
      "content": "See you at 3pm!",
      "mediaUrl": null,
      "mediaType": null,
      "sender": {
        "id": "provider-auth-id",
        "name": "Dr. Smith",
        "profilePhoto": "https://example.com/profile-image.jpg"
      },
      "createdAt": "2026-05-06T12:00:00.000Z"
    },
    "participants": [ /* ... */ ]
  }
]
```

---

### `GET` /private-messages/:chatId/messages

**Get all messages for a specific chat.** The user must be a participant of the chat.

**URL Parameters:**

| Param | Type | Description |
|---|---|---|
| `chatId` | UUID string | The chat ID |

**Success Response** `200`:

```json
{
  "messages": [
    {
      "id": "msg-uuid",
      "chatId": "chat-uuid",
      "senderId": "sender-uuid",
      "content": "Hello! How are you?",
      "mediaUrl": null,
      "mediaType": null,
      "status": "SENT",
      "createdAt": "2026-05-06T10:00:00.000Z",
      "updatedAt": "2026-05-06T10:00:00.000Z",
      "sender": {
        "id": "sender-uuid",
        "email": "user@example.com",
        "role": "USER",
        "isVerified": true,
        "name": "John Doe",
        "profilePhoto": "https://example.com/photo.jpg"
      },
      "readBy": [
        { "userId": "reader-uuid", "readAt": "2026-05-06T10:05:00.000Z" }
      ]
    }
  ]
}
```

**Error Responses:**

| Status | Message |
|---|---|
| `403` | You are not a participant in this chat |
| `404` | Chat not found |

---

### `POST` /private-messages/:chatId/messages

**Send a message via HTTP** (alternative to the WebSocket `chat:message_send` event).

**URL Parameters:**

| Param | Type | Description |
|---|---|---|
| `chatId` | UUID string | The chat ID |

**Request Body:**

```json
{
  "content": "Hello! How are you?",
  "mediaUrl": "https://example.com/image.jpg",
  "mediaType": "IMAGE"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `content` | string | Optional | Text message content |
| `mediaUrl` | URL string | Optional | URL of the attached media file |
| `mediaType` | enum | Optional | `IMAGE` \| `VIDEO` \| `AUDIO` \| `DOCUMENT` |

> At least `content` or `mediaUrl`+`mediaType` should be provided.

**Success Response** `201`: Returns the full message object with sender and chat details.

**Error Responses:**

| Status | Message |
|---|---|
| `403` | You are not a participant in this chat |
| `404` | Chat not found |

---

### `GET` /private-messages/:chatId/unread

**Get unread message count for a specific chat.**

**URL Parameters:**

| Param | Type | Description |
|---|---|---|
| `chatId` | UUID string | The chat ID |

**Success Response** `200`:

```json
{
  "chatId": "chat-uuid",
  "unreadCount": 5
}
```

---

## WebSocket Connection

### Namespace

```
/chat
```

### Connection Setup

```typescript
import { io, Socket } from 'socket.io-client';

const API_URL = 'http://your-api-url';
const token = 'your-jwt-access-token';

const chatSocket: Socket = io(`${API_URL}/chat`, {
  auth: {
    token: `Bearer ${token}`,
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Connection lifecycle
chatSocket.on('connect', () => {
  console.log('✅ Connected to chat:', chatSocket.id);
});

chatSocket.on('connect_error', (error: Error) => {
  console.error('❌ Connection failed:', error.message);
});

chatSocket.on('disconnect', (reason: string) => {
  console.log('🔌 Disconnected:', reason);
});
```

### Auto-Sent Events on Connect

When a user connects, the server automatically:

1. **Joins** the user to a private room `user:<userId>`
2. **Sets** the user as `online` in Redis with a 5-minute TTL
3. **Broadcasts** `user:status_changed` with `{ status: 'online' }` to all clients
4. **Emits** `chat:conversation_list` to the connecting client with their full chat list

---

## WebSocket Events Reference

### Messages & Conversations

| Direction | Event Name | Payload | Description |
|---|---|---|---|
| ← Auto | `chat:conversation_list` | `ChatWithDetails[]` | Sent automatically on connect with full chat list |
| → Emit | `chat:load_conversations` | `{}` | Manually refresh conversation list |
| ← Listen | `chat:conversation_list` | `ChatWithDetails[]` | Response to `load_conversations` |
| → Emit | `chat:load_single_conversation` | `{ chatId: string }` | Load messages for one chat |
| ← Listen | `chat:conversation_messages` | `{ chatId: string, messages: Message[] }` | Response with chat messages |
| → Emit | `chat:message_send` | `{ receiverId: string, content?: string, mediaUrl?: string, mediaType?: enum }` | Send a message (auto-creates chat if needed) |
| ← Listen | `chat:message_sent` | `MessagePayload` | Confirmation to sender |
| ← Listen | `chat:message_receive` | `MessagePayload` | New message notification to receiver |

### Read Receipts

| Direction | Event Name | Payload | Description |
|---|---|---|---|
| → Emit | `chat:message_read` | `{ messageId: string }` | Mark a message as read |
| ← Listen | `chat:message_read` | `{ messageId: string, readBy: string, chatId: string }` | Read receipt sent to message sender |

### Typing Indicators

| Direction | Event Name | Payload | Description |
|---|---|---|---|
| → Emit | `chat:typing_start` | `{ chatId: string, receiverId: string }` | Notify that you started typing |
| ← Listen | `chat:typing_start` | `{ userId: string, chatId: string }` | Other user started typing |
| → Emit | `chat:typing_stop` | `{ chatId: string, receiverId: string }` | Notify that you stopped typing |
| ← Listen | `chat:typing_stop` | `{ userId: string, chatId: string }` | Other user stopped typing |

### User Presence

| Direction | Event Name | Payload | Description |
|---|---|---|---|
| → Emit | `user:get_status` | `{ userId: string }` | Request a user's online status |
| ← Listen | `user:status` | `{ userId: string, status: string, lastSeen: string \| null }` | Response with presence info |
| → Emit | `user:set_status` | `{ status: 'online' \| 'away' \| 'offline' }` | Manually set your status |
| ← Listen | `user:status_changed` | `{ userId: string, status: string, timestamp: string }` | Broadcast when any user's status changes |

---

## Detailed Event Payloads

### Sending a Message

**Emit** → `chat:message_send`

```json
{
  "receiverId": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Hello! How are you?",
  "mediaUrl": "https://example.com/image.jpg",
  "mediaType": "IMAGE"
}
```

> **Note:** If no chat exists between you and the receiver, the server auto-creates one. The server also verifies that one of you is a USER and the other is a PROVIDER.

**Listen** ← `chat:message_sent` (to sender) / `chat:message_receive` (to receiver)

```json
{
  "id": "message-uuid",
  "chatId": "chat-uuid",
  "content": "Hello! How are you?",
  "mediaUrl": "https://example.com/image.jpg",
  "mediaType": "IMAGE",
  "sender": {
    "id": "your-uuid",
    "email": "user@example.com",
    "role": "USER",
    "isVerified": true,
    "name": "John Doe",
    "profilePhoto": "https://example.com/photo.jpg"
  },
  "receiver": {
    "id": "receiver-uuid",
    "email": "provider@example.com",
    "role": "PROVIDER",
    "isVerified": true,
    "name": "Dr. Smith",
    "profilePhoto": "https://example.com/profile.jpg"
  },
  "createdAt": "2026-05-06T10:00:00.000Z"
}
```

---

### Loading Conversations

**Emit** → `chat:load_conversations`

```json
{}
```

**Listen** ← `chat:conversation_list`

```json
[
  {
    "id": "chat-uuid",
    "type": "INDIVIDUAL",
    "unreadCount": 3,
    "otherUser": {
      "id": "other-user-id",
      "name": "Dr. Smith",
      "profilePhoto": "https://..."
    },
    "lastMessage": {
      "id": "msg-uuid",
      "content": "Hello!",
      "createdAt": "2026-05-06T10:00:00.000Z"
    },
    "participants": [ /* ... */ ]
  }
]
```

---

### Loading Single Chat Messages

**Emit** → `chat:load_single_conversation`

```json
{
  "chatId": "chat-uuid"
}
```

**Listen** ← `chat:conversation_messages`

```json
{
  "chatId": "chat-uuid",
  "messages": [
    {
      "id": "message-uuid",
      "content": "Hello!",
      "mediaUrl": null,
      "mediaType": null,
      "sender": { "id": "...", "name": "...", "profilePhoto": "..." },
      "createdAt": "2026-05-06T10:00:00.000Z"
    }
  ]
}
```

---

### Read Receipts

**Emit** → `chat:message_read`

```json
{
  "messageId": "message-uuid"
}
```

**Listen** ← `chat:message_read` (sent to the original message sender)

```json
{
  "messageId": "message-uuid",
  "readBy": "reader-user-uuid",
  "chatId": "chat-uuid"
}
```

---

### Typing Indicators

**Emit** → `chat:typing_start` or `chat:typing_stop`

```json
{
  "chatId": "chat-uuid",
  "receiverId": "receiver-uuid"
}
```

**Listen** ← `chat:typing_start` or `chat:typing_stop`

```json
{
  "userId": "typist-user-uuid",
  "chatId": "chat-uuid"
}
```

> Typing status auto-expires after 5 seconds in Redis.

---

### User Presence

**Emit** → `user:get_status`

```json
{
  "userId": "user-uuid"
}
```

**Listen** ← `user:status`

```json
{
  "userId": "user-uuid",
  "status": "online",
  "lastSeen": "2026-05-06T09:30:00.000Z"
}
```

**Listen** ← `user:status_changed` (broadcast)

```json
{
  "userId": "user-uuid",
  "status": "online",
  "timestamp": "2026-05-06T10:00:00.000Z"
}
```

---

## TypeScript Interfaces

```typescript
type RoleType = 'USER' | 'PROVIDER' | 'ADMIN';
type LiveMediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

interface UserInfo {
  id: string;
  email: string;
  role: RoleType;
  isVerified: boolean;
  name: string;               // Mapped from Auth.fullName
  profilePhoto: string | null; // USER → userProfile.profileImage.url
                                // PROVIDER → providerProfile.profileImage.url
}

interface MessagePayload {
  id: string;
  chatId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: LiveMediaType | null;
  sender: UserInfo;
  receiver: UserInfo | null;
  createdAt: string; // ISO 8601
}

interface ReadReceipt {
  userId: string;
  readAt: string; // ISO 8601
}

interface MessageWithReads extends MessagePayload {
  senderId: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  updatedAt: string;
  readBy: ReadReceipt[];
}

interface Participant {
  id: string;
  chatId: string;
  userId: string;
  joinedAt: string;
  user: UserInfo;
}

interface ChatWithDetails {
  id: string;
  type: 'INDIVIDUAL';
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  otherUser: UserInfo | null;
  lastMessage: MessagePayload | null;
  participants: Participant[];
}

interface ConversationMessages {
  chatId: string;
  messages: MessagePayload[];
}

interface ReadReceiptNotification {
  messageId: string;
  readBy: string;
  chatId: string;
}

interface TypingEvent {
  userId: string;
  chatId: string;
}

interface UserStatusEvent {
  userId: string;
  status: 'online' | 'away' | 'offline';
  timestamp?: string;
  lastSeen?: string | null;
}
```

---

## Complete Integration Example

```typescript
import { io, Socket } from 'socket.io-client';

class ChatService {
  private socket: Socket;

  constructor(apiUrl: string, token: string) {
    this.socket = io(`${apiUrl}/chat`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    this.registerListeners();
  }

  // ─── Event Listeners ────────────────────────────────────

  private registerListeners() {
    // Conversation list (auto-sent on connect + on manual refresh)
    this.socket.on('chat:conversation_list', (conversations: ChatWithDetails[]) => {
      console.log('Conversations loaded:', conversations);
      // → Update your state/store
    });

    // Incoming message from another user
    this.socket.on('chat:message_receive', (message: MessagePayload) => {
      console.log('New message:', message);
      // → Append to chat UI, play notification sound
    });

    // Confirmation that your message was sent
    this.socket.on('chat:message_sent', (message: MessagePayload) => {
      console.log('Message sent:', message);
      // → Update message status in UI (pending → sent)
    });

    // Messages loaded for a single conversation
    this.socket.on('chat:conversation_messages', (data: ConversationMessages) => {
      console.log(`Messages for chat ${data.chatId}:`, data.messages);
      // → Populate chat view
    });

    // Read receipt
    this.socket.on('chat:message_read', (data: ReadReceiptNotification) => {
      console.log('Message read:', data);
      // → Show read indicator (blue ticks)
    });

    // Typing indicators
    this.socket.on('chat:typing_start', (data: TypingEvent) => {
      console.log(`User ${data.userId} is typing in chat ${data.chatId}`);
      // → Show "typing..." indicator
    });

    this.socket.on('chat:typing_stop', (data: TypingEvent) => {
      console.log(`User ${data.userId} stopped typing`);
      // → Hide "typing..." indicator
    });

    // User presence changes
    this.socket.on('user:status_changed', (data: UserStatusEvent) => {
      console.log(`User ${data.userId} is now ${data.status}`);
      // → Update online/offline badge
    });
  }

  // ─── Emit Actions ───────────────────────────────────────

  sendMessage(receiverId: string, content?: string, mediaUrl?: string, mediaType?: string) {
    this.socket.emit('chat:message_send', { receiverId, content, mediaUrl, mediaType });
  }

  loadConversations() {
    this.socket.emit('chat:load_conversations');
  }

  loadMessages(chatId: string) {
    this.socket.emit('chat:load_single_conversation', { chatId });
  }

  markAsRead(messageId: string) {
    this.socket.emit('chat:message_read', { messageId });
  }

  startTyping(chatId: string, receiverId: string) {
    this.socket.emit('chat:typing_start', { chatId, receiverId });
  }

  stopTyping(chatId: string, receiverId: string) {
    this.socket.emit('chat:typing_stop', { chatId, receiverId });
  }

  getUserStatus(userId: string) {
    this.socket.emit('user:get_status', { userId });
  }

  setMyStatus(status: 'online' | 'away' | 'offline') {
    this.socket.emit('user:set_status', { status });
  }

  disconnect() {
    this.socket.disconnect();
  }
}
```

---

## Message Flow Diagrams

### Send Message Flow

```
Frontend (Sender)                    Server                         Frontend (Receiver)
       │                               │                                    │
       │── emit: chat:message_send ──→ │                                    │
       │   { receiverId, content }     │                                    │
       │                               │── Find or create private chat      │
       │                               │── Verify USER ↔ PROVIDER roles     │
       │                               │── Persist message to DB            │
       │                               │                                    │
       │ ←── chat:message_sent ───────│                                    │
       │   { id, chatId, sender, ... } │                                    │
       │                               │── chat:message_receive ──────────→ │
       │                               │   { id, chatId, sender, ... }      │
```

### Read Receipt Flow

```
Frontend (Reader)                    Server                         Frontend (Original Sender)
       │                               │                                    │
       │── emit: chat:message_read ──→ │                                    │
       │   { messageId }               │                                    │
       │                               │── Verify reader is participant     │
       │                               │── Upsert read receipt in DB        │
       │                               │                                    │
       │                               │── chat:message_read ─────────────→ │
       │                               │   { messageId, readBy, chatId }    │
```

---

## Important Notes

| Topic | Details |
|---|---|
| **Role Restriction** | Only `USER ↔ PROVIDER` chats allowed. `USER ↔ USER` and `PROVIDER ↔ PROVIDER` return `403 Forbidden`. Admins bypass this restriction. |
| **`name` field** | Mapped from `Auth.fullName` in the database. The raw field is `fullName`, but the API returns it as `name`. |
| **`profilePhoto` field** | For `USER` role: resolved from `userProfile.profileImage.url`. For `PROVIDER` role: resolved from `providerProfile.profileImage.url`. Returns `null` if no photo is set. |
| **Auto-connect data** | On WebSocket connect, the server automatically sends the full conversation list — no manual fetch is needed for the initial load. |
| **Media types** | `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT` (from `LiveMediaType` enum). |
| **Message content** | Either `content` (text) or `mediaUrl`+`mediaType` (attachment) or both can be provided per message. |
| **Typing TTL** | Typing status auto-expires after 5 seconds in Redis. Frontend should emit `chat:typing_start` periodically while the user is still typing. |
| **Presence TTL** | Online presence keys expire after 5 minutes in Redis. Offline status is kept for 24 hours. |
| **Chat creation** | When sending a message via WebSocket (`chat:message_send`), if no chat exists, the server automatically creates one. Via HTTP, use `POST /private-messages/start` first. |