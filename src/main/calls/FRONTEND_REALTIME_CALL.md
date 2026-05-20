# Frontend Integration Guide: Real-Time Call WebSocket

This document provides a simple, direct guide for frontend and app developers to integrate WebRTC audio/video calling using WebSockets for signaling.

**Namespace**: `/realtime-call` (Connect via this path)  
**Authentication**: Valid JWT Bearer token required in the connection handshake.

---

## 1. Connection Example

Pass the token via the `auth` object when connecting.

```javascript
import { io } from "socket.io-client";

const socket = io("http://your-api-url/realtime-call", {
  auth: {
    token: "Bearer YOUR_JWT_TOKEN"
  }
});

socket.on("connect", () => {
    console.log("Connected to Real-Time Call signaling!", socket.id);
});

socket.on("connect_error", (err) => {
    console.error("Connection failed:", err.message);
});
```

---

## 2. Events Overview

A quick reference for Call Management and WebRTC Signaling events.

| Client Emit Event | Server Response / Listener | Input Payload (Type) | Description |
| :--- | :--- | :--- | :--- |
| **`start-call`** | `call-started` (to caller)<br>`incoming-call` (to receiver) | `{ hostUserId: UUID, recipientUserId: UUID, title?: string }` | Initiate a new call to another user. |
| **`accept-call`** | `call-active` (to caller) | `{ callId: UUID, callerId: UUID }` | Receiver accepts the incoming call. |
| **`decline-call`** | `call-declined` (broadcast) | `{ callId: UUID }` | Receiver declines the incoming call. |
| **`end-call`** | `call-ended` (to both users) | `{ callId: UUID, callerId: UUID, receiverId: UUID }` | End an active or ringing call. |
| **`webrtc-offer`** | `webrtc-offer` (to receiver) | `{ roomId: UUID, offer: any, receiverId: UUID }` | WebRTC step: Caller sends session description. |
| **`webrtc-answer`** | `webrtc-answer` (to caller) | `{ roomId: UUID, answer: any, callerId: UUID }` | WebRTC step: Receiver replies with session description. |
| **`ice-candidate`** | `ice-candidate` (to target user) | `{ roomId: UUID, candidate: any, targetUserId: UUID }` | WebRTC step: Negotiate network path details. |

---

## 3. Payload Details & Explanations

### Step 1: Making & Receiving a Call

**Start a Call**  
_Emit_: `start-call`
```json
{
  "hostUserId": "your-user-uuid",
  "recipientUserId": "recipient-user-uuid",
  "title": "Optional Call Title"
}
```

**Call Started (Acknowledge to Caller)**  
_Listen_: `call-started`  
```json
{
  "callId": "call-uuid",
  "to": "recipient-user-uuid",
  "title": "Optional Call Title"
}
```

**Incoming Call (Triggered on Receiver's device)**  
_Listen_: `incoming-call`  
```json
{
  "callId": "call-uuid",
  "from": "caller-user-uuid",
  "title": "Optional Call Title"
}
```

---

### Step 2: Answering or Declining

**Accept the Call (Receiver)**  
_Emit_: `accept-call`  
```json
{
  "callId": "call-uuid",
  "callerId": "caller-user-uuid"
}
```

**Call Active (Triggered to Caller when accepted)**  
_Listen_: `call-active`  
```json
{
  "callId": "call-uuid"
}
```
*(Once this happens, both sides should begin the WebRTC negotiation below).*

**Decline the Call (Receiver)**  
_Emit_: `decline-call`  
```json
{
  "callId": "call-uuid"
}
```

**Call Declined (Listen for decline)**  
_Listen_: `call-declined`  
```json
{
  "callId": "call-uuid"
}
```

---

### Step 3: Ending the Call

**End Call (By either side)**  
_Emit_: `end-call`  
```json
{
  "callId": "call-uuid",
  "callerId": "caller-user-uuid",
  "receiverId": "receiver-user-uuid"
}
```

**Call Ended Notification**  
_Listen_: `call-ended`  
```json
{
  "callId": "call-uuid"
}
```

---

### Step 4: WebRTC Signaling (Peer-to-Peer Connection)

For video/audio to actually work, device session descriptions and ICE routes need to be exchanged. `roomId` is typically the `callId`.

**Send WebRTC Offer (Usually Caller)**  
_Emit_: `webrtc-offer`
```json
{
  "roomId": "call-uuid",
  "offer": { "type": "offer", "sdp": "v=0\r\no=-..." },
  "receiverId": "receiver-user-uuid"
}
```
> Receiver listens for `webrtc-offer` and applies the remote description.

**Send WebRTC Answer (Usually Receiver)**  
_Emit_: `webrtc-answer`
```json
{
  "roomId": "call-uuid",
  "answer": { "type": "answer", "sdp": "v=0\r\no=-..." },
  "callerId": "caller-user-uuid"
}
```
> Caller listens for `webrtc-answer` and applies the remote description.

**Send ICE Candidates (Both sides)**  
_Emit_: `ice-candidate`
```json
{
  "roomId": "call-uuid",
  "candidate": { "candidate": "...", "sdpMid": "0", "sdpMLineIndex": 0 },
  "targetUserId": "other-user-uuid"
}
```
> Devices use the `ice-candidate` listener to add ICE candidates to their local RTCPeerConnection.