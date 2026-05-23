# Rhisya — Real-Time Call Integration Guide

> **Version:** 1.0  
> **Last Updated:** May 22, 2026  
> **Audience:** Frontend developers integrating real-time audio/video calling

Rhisya's Real-Time Call system is a **WebRTC-based audio/video calling** platform. The backend provides signaling via a **Socket.IO WebSocket** namespace and a **REST endpoint** for querying call status. Actual media streams (audio & video) are transmitted **peer-to-peer** via WebRTC — the server only facilitates signaling and call state management.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Authentication](#authentication)
  - [HTTP Authentication](#http-authentication)
  - [WebSocket Authentication](#websocket-authentication)
  - [WebSocket Authentication Error Codes](#websocket-authentication-error-codes)
- [HTTP REST API Endpoint](#http-rest-api-endpoint)
  - [GET /realtime-call/:callId/status](#get-realtime-callcallidstatus)
  - [Call Status Enum](#call-status-enum)
- [WebSocket Connection](#websocket-connection)
  - [Namespace](#namespace)
  - [Connection Setup](#connection-setup)
- [WebSocket Events Reference](#websocket-events-reference)
  - [Call Management Events](#call-management-events)
  - [WebRTC Signaling Events](#webrtc-signaling-events)
- [Call Lifecycle & State Machine](#call-lifecycle--state-machine)
- [Complete Call Flow (Step by Step)](#complete-call-flow-step-by-step)
  - [Step 1: Initiate Call](#step-1-initiate-call)
  - [Step 2: Accept or Decline](#step-2-accept-or-decline)
  - [Step 3: WebRTC Negotiation](#step-3-webrtc-negotiation)
  - [Step 4: End Call](#step-4-end-call)
- [Complete Frontend Integration Example](#complete-frontend-integration-example)
- [Important Notes & Production Considerations](#important-notes--production-considerations)

---

## Architecture Overview

```
┌──────────────┐         Socket.IO (/realtime-call)         ┌──────────────┐
│              │ ◄────────── signaling events ─────────────► │              │
│   Caller     │                                             │   Receiver   │
│  (Frontend)  │ ◄═══════ WebRTC peer-to-peer media ═══════► │  (Frontend)  │
│              │            (audio / video)                   │              │
└──────┬───────┘                                             └──────┬───────┘
       │                                                            │
       │  REST / WebSocket                                          │  REST / WebSocket
       │                                                            │
       └──────────────────► ┌──────────────┐ ◄──────────────────────┘
                            │              │
                            │   Rhisya     │
                            │   Backend    │
                            │  (NestJS)    │
                            │              │
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │  PostgreSQL  │
                            │  (Call State) │
                            └──────────────┘
```

**Key architectural points:**

| Concern | Implementation |
|---|---|
| **Signaling transport** | Socket.IO WebSocket — namespace `/realtime-call` |
| **Signaling protocol** | SDP Offer/Answer + ICE candidate exchange |
| **Media transport** | Peer-to-peer via WebRTC (not routed through the server) |
| **Call state persistence** | PostgreSQL database |
| **Authentication** | JWT Bearer token (both HTTP and WebSocket) |
| **Room identification** | The `roomId` used in WebRTC signaling events **must** be set to the `callId` |

---

## Authentication

Authentication for the Real-Time Call system follows the same JWT-based mechanism used throughout Rhisya (identical to chat).

### HTTP Authentication

Include the JWT Bearer token in the `Authorization` header of every HTTP request:

```
Authorization: Bearer <token>
```

### WebSocket Authentication

Pass the JWT token in the `auth` object during the Socket.IO handshake:

```typescript
const socket = io(`${API_URL}/realtime-call`, {
  auth: {
    token: `Bearer ${token}`,
  },
});
```

### WebSocket Authentication Error Codes

If authentication fails during the WebSocket handshake, the server emits a `connect_error` with one of the following error codes in the message:

| Error Code | Description |
|---|---|
| `MISSING_AUTH_HEADER` | No authorization header or `auth.token` provided |
| `INVALID_OR_EMPTY_TOKEN` | Token string is empty or malformed |
| `SERVER_CONFIG_ERROR` | Server-side JWT secret not configured |
| `TOKEN_EXPIRED` | JWT token has expired |
| `INVALID_TOKEN_SIGNATURE` | JWT signature verification failed |
| `TOKEN_VERIFICATION_FAILED` | Generic JWT verification error |
| `MISSING_USER_ID` | Token payload missing `sub` (user ID) |
| `USER_NOT_FOUND` | User ID from token not found in database |
| `AUTH_FAILED` | Generic authentication failure |

**Example — Handling auth errors on the client:**

```typescript
callSocket.on('connect_error', (error: Error) => {
  const code = error.message; // e.g. "TOKEN_EXPIRED"

  switch (code) {
    case 'TOKEN_EXPIRED':
      // Refresh the token and reconnect
      refreshTokenAndReconnect();
      break;
    case 'MISSING_AUTH_HEADER':
    case 'INVALID_OR_EMPTY_TOKEN':
      // Redirect to login
      redirectToLogin();
      break;
    default:
      console.error('Authentication failed:', code);
  }
});
```

---

## HTTP REST API Endpoint

> **Base path:** `/realtime-call`  
> **Guards:** `JwtAuthGuard`, `RolesGuard`

### GET /realtime-call/:callId/status

Retrieve the current status of a specific call.

**Request:**

| Parameter | Location | Type | Required | Description |
|---|---|---|---|---|
| `callId` | URL Path | `UUID` | ✅ | The unique identifier of the call |

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Success Response — `200 OK`:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "ACTIVE",
  "startedAt": "2026-05-06T10:00:00.000Z",
  "endedAt": null,
  "hostUserId": "11111111-aaaa-bbbb-cccc-222222222222",
  "recipientUserId": "33333333-dddd-eeee-ffff-444444444444",
  "title": "Health Consultation"
}
```

**Response Fields:**

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | `string (UUID)` | No | Unique call identifier |
| `status` | `string (enum)` | No | Current call status (see enum below) |
| `startedAt` | `string (ISO 8601)` | No | Timestamp when the call was initiated |
| `endedAt` | `string (ISO 8601)` | Yes | Timestamp when the call ended (`null` if still active) |
| `hostUserId` | `string (UUID)` | No | User ID of the caller (initiator) |
| `recipientUserId` | `string (UUID)` | No | User ID of the recipient |
| `title` | `string` | Yes | Optional title/description for the call |

### Call Status Enum

| Value | Description |
|---|---|
| `CALLING` | Call has been initiated, waiting for recipient response |
| `RINING` | Recipient's device is ringing (recipient is online) |
| `ACTIVE` | Call is currently in progress |
| `END` | Call ended normally by either party |
| `MISSED` | Recipient was offline when the call was initiated |
| `DECLINED` | Recipient explicitly declined the call |

> **⚠️ Note:** The status value is `RINING` (not `RINGING`). This is intentional and consistent across the backend.

---

## WebSocket Connection

### Namespace

```
/realtime-call
```

All call signaling events are scoped to this namespace. You must connect to it explicitly — it is separate from any other namespaces (e.g., chat).

### Connection Setup

```typescript
import { io, Socket } from 'socket.io-client';

const API_URL = 'http://your-api-url';
const token = 'your-jwt-token';

const callSocket: Socket = io(`${API_URL}/realtime-call`, {
  auth: {
    token: `Bearer ${token}`,
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// ✅ Connection established
callSocket.on('connect', () => {
  console.log('✅ Connected to call signaling:', callSocket.id);
});

// ❌ Connection error (including auth failures)
callSocket.on('connect_error', (error: Error) => {
  console.error('❌ Connection failed:', error.message);
});

// 🔌 Disconnected
callSocket.on('disconnect', (reason: string) => {
  console.log('🔌 Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server forcefully disconnected — possibly auth revoked
    callSocket.connect(); // manually reconnect
  }
});
```

**Recommended connection options:**

| Option | Value | Rationale |
|---|---|---|
| `transports` | `['websocket']` | Skip HTTP long-polling, connect directly via WebSocket |
| `reconnection` | `true` | Auto-reconnect on unexpected disconnects |
| `reconnectionAttempts` | `5` | Limit retry attempts to avoid infinite loops |
| `reconnectionDelay` | `1000` | 1-second delay between reconnection attempts |

---

## WebSocket Events Reference

### Call Management Events

These events control the call lifecycle — initiating, accepting, declining, and ending calls.

| Direction | Event Name | Payload | Description |
|---|---|---|---|
| `→ Emit` | `start-call` | `{ hostUserId: string, recipientUserId: string, title?: string }` | Initiate a new call |
| `← Listen` | `call-started` | `{ callId: string, to: string, title?: string }` | Confirmation sent to the **caller** that the call was created |
| `← Listen` | `incoming-call` | `{ callId: string, from: string, title?: string }` | Notification sent to the **receiver** of an incoming call |
| `→ Emit` | `accept-call` | `{ callId: string, callerId: string }` | Receiver accepts the incoming call |
| `← Listen` | `call-active` | `{ callId: string }` | Notification sent to the **caller** that the call was accepted |
| `→ Emit` | `decline-call` | `{ callId: string }` | Receiver declines the incoming call |
| `← Listen` | `call-declined` | `{ callId: string }` | Broadcast notification that the call was declined |
| `→ Emit` | `end-call` | `{ callId: string, callerId: string, receiverId: string }` | Either party ends an active call |
| `← Listen` | `call-ended` | `{ callId: string }` | Notification sent to **both** parties that the call has ended |

### WebRTC Signaling Events

These events facilitate the WebRTC peer-to-peer connection setup (SDP negotiation and ICE candidate exchange).

| Direction | Event Name | Payload | Description |
|---|---|---|---|
| `→ Emit` | `webrtc-offer` | `{ roomId: string, offer: RTCSessionDescriptionInit, receiverId: string }` | Caller sends the SDP offer to the receiver |
| `← Listen` | `webrtc-offer` | `{ roomId: string, offer: RTCSessionDescriptionInit }` | Receiver receives the SDP offer |
| `→ Emit` | `webrtc-answer` | `{ roomId: string, answer: RTCSessionDescriptionInit, callerId: string }` | Receiver sends the SDP answer back to the caller |
| `← Listen` | `webrtc-answer` | `{ roomId: string, answer: RTCSessionDescriptionInit }` | Caller receives the SDP answer |
| `→ Emit` | `ice-candidate` | `{ roomId: string, candidate: RTCIceCandidateInit, targetUserId: string }` | Send an ICE candidate to the other party |
| `← Listen` | `ice-candidate` | `{ roomId: string, candidate: RTCIceCandidateInit }` | Receive an ICE candidate from the other party |

> **Key:** `→ Emit` = Client sends to server &nbsp;|&nbsp; `← Listen` = Client receives from server

---

## Call Lifecycle & State Machine

The call progresses through a well-defined set of states:

```
                    ┌─────────────────────────────────────┐
                    │          start-call emitted          │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                             ┌──────────┐
                             │ CALLING  │
                             └────┬─────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
             Receiver Online             Receiver Offline
                    │                           │
                    ▼                           ▼
              ┌──────────┐               ┌──────────┐
              │  RINING  │               │  MISSED  │
              └────┬─────┘               └──────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    accept-call          decline-call
         │                   │
         ▼                   ▼
   ┌──────────┐        ┌──────────┐
   │  ACTIVE  │        │ DECLINED │
   └────┬─────┘        └──────────┘
        │
    end-call
        │
        ▼
   ┌──────────┐
   │   END    │
   └──────────┘
```

**State transition summary:**

| From | To | Trigger |
|---|---|---|
| `CALLING` | `RINING` | Receiver is online |
| `CALLING` | `MISSED` | Receiver is offline |
| `RINING` | `ACTIVE` | Receiver accepted the call |
| `RINING` | `DECLINED` | Receiver declined the call |
| `ACTIVE` | `END` | Either party ended the call |

---

## Complete Call Flow (Step by Step)

### Step 1: Initiate Call

The caller starts a new call by emitting the `start-call` event.

```typescript
// Caller side
callSocket.emit('start-call', {
  hostUserId: 'caller-user-id',
  recipientUserId: 'receiver-user-id',
  title: 'Health Consultation', // optional
});
```

**What happens on the server:**

1. A new `Calling` record is created in the database with status `CALLING`.
2. The server checks if the **receiver** is currently connected to the `/realtime-call` namespace.
   - **If online:** Status is updated to `RINING`. The server emits:
     - `call-started` → to the **caller** with `{ callId, to, title }`
     - `incoming-call` → to the **receiver** with `{ callId, from, title }`
   - **If offline:** Status is updated to `MISSED`. No events are sent to the receiver.

```typescript
// Caller — listen for confirmation
callSocket.on('call-started', (data: { callId: string; to: string; title?: string }) => {
  console.log(`📞 Call created: ${data.callId}, ringing ${data.to}...`);
  // Show "Calling..." UI with ringtone
});

// Receiver — listen for incoming calls
callSocket.on('incoming-call', (data: { callId: string; from: string; title?: string }) => {
  console.log(`📲 Incoming call from ${data.from}: ${data.callId}`);
  // Show incoming call UI with Accept / Decline buttons
});
```

### Step 2: Accept or Decline

#### Accept

The receiver accepts the incoming call:

```typescript
// Receiver side
callSocket.emit('accept-call', {
  callId: 'the-call-id',
  callerId: 'caller-user-id',
});
```

**Server response:**
- Status is updated to `ACTIVE`.
- The server emits `call-active` → to the **caller**.

```typescript
// Caller — listen for acceptance
callSocket.on('call-active', async (data: { callId: string }) => {
  console.log(`✅ Call ${data.callId} is now active!`);
  // Begin WebRTC negotiation (Step 3)
});
```

#### Decline

The receiver declines the incoming call:

```typescript
// Receiver side
callSocket.emit('decline-call', {
  callId: 'the-call-id',
});
```

**Server response:**
- Status is updated to `DECLINED`.
- The server broadcasts `call-declined` to relevant parties.

```typescript
// Caller — listen for decline
callSocket.on('call-declined', (data: { callId: string }) => {
  console.log(`❌ Call ${data.callId} was declined.`);
  // Dismiss calling UI, play "call declined" tone
});
```

### Step 3: WebRTC Negotiation

> This step begins **after** the call reaches `ACTIVE` status.

The WebRTC negotiation follows the standard **Offer → Answer → ICE** pattern:

```
  Caller                        Server                      Receiver
    │                             │                             │
    │  1. Create RTCPeerConnection                              │
    │  2. getUserMedia (camera/mic)                             │
    │  3. Create SDP Offer        │                             │
    │                             │                             │
    │──── webrtc-offer ──────────►│──── webrtc-offer ──────────►│
    │                             │                             │
    │                             │     4. Set remote desc      │
    │                             │     5. Create SDP Answer    │
    │                             │                             │
    │◄─── webrtc-answer ─────────│◄─── webrtc-answer ──────────│
    │                             │                             │
    │  6. Set remote description  │                             │
    │                             │                             │
    │◄──► ice-candidate ◄────────►│◄──► ice-candidate ◄────────►│
    │     (exchanged in both directions until connectivity)     │
    │                             │                             │
    │═══════════ Peer-to-Peer Media Stream (Audio/Video) ══════│
```

**Caller — Create and send offer:**

```typescript
// 1. Create peer connection
const peerConnection = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
});

// 2. Get local media
const localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
});
localStream.getTracks().forEach((track) => {
  peerConnection.addTrack(track, localStream);
});

// Display local video
const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
localVideo.srcObject = localStream;

// 3. Handle ICE candidates
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    callSocket.emit('ice-candidate', {
      roomId: callId,           // roomId = callId
      candidate: event.candidate,
      targetUserId: receiverId,
    });
  }
};

// 4. Handle remote tracks
peerConnection.ontrack = (event) => {
  const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
  remoteVideo.srcObject = event.streams[0];
};

// 5. Create and send offer
const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);

callSocket.emit('webrtc-offer', {
  roomId: callId,
  offer: offer,
  receiverId: receiverId,
});
```

**Receiver — Handle offer and send answer:**

```typescript
callSocket.on('webrtc-offer', async (data) => {
  // Set remote description from the offer
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.offer)
  );

  // Create and send answer
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  callSocket.emit('webrtc-answer', {
    roomId: data.roomId,
    answer: answer,
    callerId: callerId,
  });
});
```

**Caller — Handle answer:**

```typescript
callSocket.on('webrtc-answer', async (data) => {
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.answer)
  );
});
```

**Both sides — Exchange ICE candidates:**

```typescript
callSocket.on('ice-candidate', async (data) => {
  if (peerConnection && data.candidate) {
    await peerConnection.addIceCandidate(
      new RTCIceCandidate(data.candidate)
    );
  }
});
```

### Step 4: End Call

Either party can end the call at any time:

```typescript
callSocket.emit('end-call', {
  callId: 'the-call-id',
  callerId: 'caller-user-id',
  receiverId: 'receiver-user-id',
});
```

**Server response:**
- Status is updated to `END`.
- The server emits `call-ended` to **both** parties.

```typescript
callSocket.on('call-ended', (data: { callId: string }) => {
  console.log(`📴 Call ${data.callId} has ended.`);

  // Clean up WebRTC resources
  localStream?.getTracks().forEach((track) => track.stop());
  peerConnection?.close();

  // Reset UI
});
```

---

## Complete Frontend Integration Example

A production-ready `CallService` class that encapsulates all call and WebRTC logic:

```typescript
import { io, Socket } from 'socket.io-client';

// ─── Type Definitions ────────────────────────────────────────────

interface CallStartedData {
  callId: string;
  to: string;
  title?: string;
}

interface IncomingCallData {
  callId: string;
  from: string;
  title?: string;
}

interface CallActiveData {
  callId: string;
}

interface CallDeclinedData {
  callId: string;
}

interface CallEndedData {
  callId: string;
}

interface WebRTCOfferData {
  roomId: string;
  offer: RTCSessionDescriptionInit;
}

interface WebRTCAnswerData {
  roomId: string;
  answer: RTCSessionDescriptionInit;
}

interface ICECandidateData {
  roomId: string;
  candidate: RTCIceCandidateInit;
}

interface CallEventHandlers {
  onCallStarted?: (data: CallStartedData) => void;
  onIncomingCall?: (data: IncomingCallData) => void;
  onCallActive?: (data: CallActiveData) => void;
  onCallDeclined?: (data: CallDeclinedData) => void;
  onCallEnded?: (data: CallEndedData) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

// ─── Call Service ─────────────────────────────────────────────────

class CallService {
  private socket: Socket;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private currentCallId: string | null = null;
  private remoteUserId: string | null = null;
  private handlers: CallEventHandlers;

  private readonly iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for production:
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'username',
    //   credential: 'password',
    // },
  ];

  constructor(apiUrl: string, token: string, handlers: CallEventHandlers = {}) {
    this.handlers = handlers;

    // ── Initialize Socket.IO connection ──
    this.socket = io(`${apiUrl}/realtime-call`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.registerSocketListeners();
  }

  // ─── Socket Event Listeners ───────────────────────────────────

  private registerSocketListeners(): void {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to call signaling:', this.socket.id);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Connection failed:', error.message);
      this.handlers.onError?.(error);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('🔌 Disconnected:', reason);
    });

    // ── Call Management Events ──

    this.socket.on('call-started', (data: CallStartedData) => {
      console.log('📞 Call started, waiting for receiver...', data);
      this.currentCallId = data.callId;
      this.handlers.onCallStarted?.(data);
    });

    this.socket.on('incoming-call', (data: IncomingCallData) => {
      console.log('📲 Incoming call from:', data.from);
      this.currentCallId = data.callId;
      this.remoteUserId = data.from;
      this.handlers.onIncomingCall?.(data);
    });

    this.socket.on('call-active', async (data: CallActiveData) => {
      console.log('✅ Call accepted! Starting WebRTC...', data);
      this.handlers.onCallActive?.(data);
      // Caller initiates WebRTC after call is accepted
      await this.initializeWebRTC(data.callId);
      await this.createAndSendOffer(data.callId);
    });

    this.socket.on('call-declined', (data: CallDeclinedData) => {
      console.log('❌ Call was declined:', data);
      this.handlers.onCallDeclined?.(data);
      this.cleanup();
    });

    this.socket.on('call-ended', (data: CallEndedData) => {
      console.log('📴 Call ended:', data);
      this.handlers.onCallEnded?.(data);
      this.cleanup();
    });

    // ── WebRTC Signaling Events ──

    this.socket.on('webrtc-offer', async (data: WebRTCOfferData) => {
      console.log('📡 Received WebRTC offer');
      await this.handleOffer(data);
    });

    this.socket.on('webrtc-answer', async (data: WebRTCAnswerData) => {
      console.log('📡 Received WebRTC answer');
      await this.handleAnswer(data);
    });

    this.socket.on('ice-candidate', async (data: ICECandidateData) => {
      if (this.peerConnection && data.candidate) {
        try {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (err) {
          console.error('Failed to add ICE candidate:', err);
        }
      }
    });
  }

  // ─── Call Actions (Public API) ────────────────────────────────

  /**
   * Initiate a new call to a recipient.
   */
  startCall(hostUserId: string, recipientUserId: string, title?: string): void {
    this.remoteUserId = recipientUserId;
    this.socket.emit('start-call', { hostUserId, recipientUserId, title });
  }

  /**
   * Accept an incoming call.
   */
  async acceptCall(callId: string, callerId: string): Promise<void> {
    this.remoteUserId = callerId;
    this.currentCallId = callId;
    // Initialize WebRTC before accepting so we're ready for the offer
    await this.initializeWebRTC(callId);
    this.socket.emit('accept-call', { callId, callerId });
  }

  /**
   * Decline an incoming call.
   */
  declineCall(callId: string): void {
    this.socket.emit('decline-call', { callId });
    this.cleanup();
  }

  /**
   * End the current active call.
   */
  endCall(callId: string, callerId: string, receiverId: string): void {
    this.socket.emit('end-call', { callId, callerId, receiverId });
    this.cleanup();
  }

  // ─── WebRTC Methods (Private) ────────────────────────────────

  /**
   * Initialize RTCPeerConnection and acquire local media.
   */
  private async initializeWebRTC(callId: string): Promise<void> {
    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    // ICE candidate handling
    this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && this.remoteUserId) {
        this.socket.emit('ice-candidate', {
          roomId: callId,
          candidate: event.candidate,
          targetUserId: this.remoteUserId,
        });
      }
    };

    // Remote track handling
    this.peerConnection.ontrack = (event: RTCTrackEvent) => {
      console.log('🎥 Remote track received');
      this.handlers.onRemoteStream?.(event.streams[0]);
    };

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;
      console.log('🔗 Connection state:', state);
      this.handlers.onConnectionStateChange?.(state);

      if (state === 'failed' || state === 'disconnected') {
        console.warn('⚠️ Peer connection lost');
      }
    };

    // Acquire local media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
      this.handlers.onLocalStream?.(this.localStream);
    } catch (err) {
      console.error('Failed to get local media:', err);
      this.handlers.onError?.(err as Error);
    }
  }

  /**
   * Create an SDP offer and send it to the receiver.
   */
  private async createAndSendOffer(callId: string): Promise<void> {
    if (!this.peerConnection || !this.remoteUserId) return;

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.socket.emit('webrtc-offer', {
      roomId: callId,
      offer: offer,
      receiverId: this.remoteUserId,
    });
  }

  /**
   * Handle an incoming SDP offer (receiver side).
   */
  private async handleOffer(data: WebRTCOfferData): Promise<void> {
    if (!this.peerConnection) {
      await this.initializeWebRTC(data.roomId);
    }

    await this.peerConnection!.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );

    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    this.socket.emit('webrtc-answer', {
      roomId: data.roomId,
      answer: answer,
      callerId: this.remoteUserId!,
    });
  }

  /**
   * Handle an incoming SDP answer (caller side).
   */
  private async handleAnswer(data: WebRTCAnswerData): Promise<void> {
    await this.peerConnection?.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    );
  }

  // ─── Media Controls (Public API) ─────────────────────────────

  /**
   * Toggle the local microphone on/off.
   */
  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle the local camera on/off.
   */
  toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  // ─── Cleanup ─────────────────────────────────────────────────

  /**
   * Release all WebRTC resources (tracks, peer connection).
   */
  private cleanup(): void {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.peerConnection?.close();
    this.peerConnection = null;
    this.localStream = null;
    this.currentCallId = null;
    this.remoteUserId = null;
  }

  /**
   * Fully disconnect from the signaling server and release all resources.
   */
  disconnect(): void {
    this.cleanup();
    this.socket.disconnect();
  }
}

export default CallService;
```

### Usage Example

```typescript
import CallService from './CallService';

const callService = new CallService(
  'https://api.rhisya.com',
  myJwtToken,
  {
    onIncomingCall: (data) => {
      // Show incoming call modal
      showIncomingCallUI(data.from, data.callId, data.title);
    },
    onCallActive: (data) => {
      // Transition to active call screen
      navigateToCallScreen(data.callId);
    },
    onCallEnded: () => {
      // Return to previous screen
      navigateBack();
    },
    onRemoteStream: (stream) => {
      // Attach to video element
      const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
      remoteVideo.srcObject = stream;
    },
    onLocalStream: (stream) => {
      // Attach to local preview
      const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
      localVideo.srcObject = stream;
      localVideo.muted = true; // Avoid echo
    },
    onError: (error) => {
      showErrorToast(error.message);
    },
  }
);

// ── Start a call ──
callService.startCall('my-user-id', 'recipient-user-id', 'Quick Chat');

// ── Accept an incoming call ──
callService.acceptCall('call-id', 'caller-user-id');

// ── Decline a call ──
callService.declineCall('call-id');

// ── End the current call ──
callService.endCall('call-id', 'caller-user-id', 'receiver-user-id');

// ── Toggle mic/camera ──
const isMuted = !callService.toggleMute();
const isCameraOff = !callService.toggleVideo();

// ── Disconnect entirely ──
callService.disconnect();
```

---

## Important Notes & Production Considerations

### General

| Topic | Detail |
|---|---|
| **`roomId` mapping** | The `roomId` in all WebRTC signaling events **must** always be set to the `callId` |
| **Status spelling** | The call status enum uses `RINING` (not `RINGING`) — this is **intentional** and matches the backend schema |
| **Offline recipients** | If the receiver is offline when `start-call` is emitted, the call is automatically marked as `MISSED` |
| **Namespace isolation** | Both users must be connected to the `/realtime-call` namespace for signaling to work |
| **Media routing** | Audio/video streams flow **peer-to-peer** via WebRTC — they do **not** pass through the server |

### STUN / TURN Servers

The example uses Google's free public STUN server (`stun:stun.l.google.com:19302`), which is suitable for development. **For production**, you should configure TURN servers to handle NAT traversal in restrictive network environments:

```typescript
const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'your-username',
    credential: 'your-credential',
  },
];
```

> Without a TURN server, calls may fail for users behind symmetric NATs or strict firewalls.

### Error Handling Best Practices

- Always wrap `getUserMedia` in try/catch — the user may deny camera/microphone permissions.
- Listen for `peerConnection.onconnectionstatechange` to detect failed connections.
- Handle `connect_error` on the socket to catch auth failures and network issues.
- Implement a timeout for the `RINING` state — if no accept/decline is received within a reasonable time (e.g., 30–60 seconds), automatically end the call.

### Browser Permissions

The browser will prompt the user for camera and microphone access. Ensure your application:

1. Requests permissions **only** when needed (not on page load).
2. Handles the `NotAllowedError` (user denied) and `NotFoundError` (no device) exceptions gracefully.
3. Provides clear UI feedback about permission status.

---

*This document is auto-generated for Rhisya v1.0. For questions or updates, contact the backend team.*