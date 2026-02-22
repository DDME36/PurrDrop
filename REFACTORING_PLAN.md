# 🔧 Refactoring Plan - PurrDrop

## Priority 1: Break Down Monolithic Hook (HIGH)

### Current Problem
`usePeerConnection.ts` is ~1,000 lines handling:
- Socket.IO connection
- WebRTC peer connections
- DataChannel management
- File transfer logic
- Text message handling
- UI state management

### Proposed Architecture

```
src/services/
├── SignalingService.ts      # Socket.IO wrapper (framework-agnostic)
├── WebRTCManager.ts          # RTCPeerConnection lifecycle
├── DataChannelManager.ts     # DataChannel handling
└── FileTransferService.ts    # File chunking & streaming

src/hooks/
├── useSignaling.ts           # React wrapper for SignalingService
├── useWebRTC.ts              # React wrapper for WebRTCManager
├── useFileTransfer.ts        # File transfer state
└── usePeerConnection.ts      # Orchestrator (much smaller)
```

### Benefits
- ✅ Testable (can unit test services without React)
- ✅ Reusable (can use in React Native, Electron, etc.)
- ✅ Maintainable (each file < 300 lines)
- ✅ Better performance (fewer re-renders)

### Implementation Steps

#### Step 1: Extract SignalingService (Week 1)
```typescript
// src/services/SignalingService.ts
export class SignalingService {
  private socket: Socket | null = null;
  private eventHandlers = new Map<string, Function>();

  connect(peer: Peer) { /* ... */ }
  disconnect() { /* ... */ }
  emit(event: string, data: any) { /* ... */ }
  on(event: string, handler: Function) { /* ... */ }
  off(event: string) { /* ... */ }
}
```

#### Step 2: Extract WebRTCManager (Week 2)
```typescript
// src/services/WebRTCManager.ts
export class WebRTCManager {
  private connections = new Map<string, RTCPeerConnection>();
  private iceServers: RTCIceServer[] = [];

  createConnection(peerId: string): RTCPeerConnection { /* ... */ }
  closeConnection(peerId: string) { /* ... */ }
  getConnection(peerId: string): RTCPeerConnection | undefined { /* ... */ }
}
```

#### Step 3: Extract DataChannelManager (Week 3)
```typescript
// src/services/DataChannelManager.ts
export class DataChannelManager {
  private channels = new Map<string, RTCDataChannel>();

  createChannel(pc: RTCPeerConnection, peerId: string): RTCDataChannel { /* ... */ }
  sendMessage(peerId: string, message: any) { /* ... */ }
  onMessage(peerId: string, handler: (data: any) => void) { /* ... */ }
}
```

#### Step 4: Create React Hooks (Week 4)
```typescript
// src/hooks/useSignaling.ts
export function useSignaling() {
  const serviceRef = useRef<SignalingService>();
  // Wrap service with React state
}
```

### Testing Strategy
- Unit tests for services (Jest/Vitest)
- Integration tests for hooks (React Testing Library)
- E2E tests for full flow (Playwright)

---

## Priority 2: Adaptive Chunk Size (MEDIUM)

### Current Problem
Fixed 64KB chunks don't adapt to network conditions.

### Solution
```typescript
class AdaptiveChunker {
  private chunkSize = 16 * 1024; // Start small
  private readonly MIN_CHUNK = 16 * 1024;
  private readonly MAX_CHUNK = 256 * 1024;

  adjustChunkSize(bufferedAmount: number, threshold: number) {
    if (bufferedAmount < threshold * 0.5) {
      // Network is fast, increase chunk size
      this.chunkSize = Math.min(this.chunkSize * 1.5, this.MAX_CHUNK);
    } else if (bufferedAmount > threshold * 0.8) {
      // Network is slow, decrease chunk size
      this.chunkSize = Math.max(this.chunkSize * 0.75, this.MIN_CHUNK);
    }
    return Math.floor(this.chunkSize);
  }
}
```

---

## Priority 3: Room Code Security (MEDIUM)

### Current Problem
- Weak room code generation (can loop infinitely)
- Plain text passwords

### Solution

#### Better Room Code Generation
```typescript
import { randomBytes } from 'crypto';

function generateRoomCode(): string {
  // Use crypto for better randomness
  const bytes = randomBytes(3);
  const num = bytes.readUIntBE(0, 3) % 90000 + 10000;
  return num.toString();
}

// Add max retry limit
function generateUniqueRoomCode(rooms: Map<string, any>, maxRetries = 10): string {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateRoomCode();
    if (!rooms.has(code)) return code;
  }
  throw new Error('Unable to generate unique room code');
}
```

#### Hash Passwords
```typescript
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// In server.ts
socket.on('set-mode', ({ mode, roomCode, password }) => {
  const hashedPassword = password ? hashPassword(password) : null;
  rooms.set(roomCode, { 
    peers: [], 
    password: hashedPassword 
  });
});
```

---

## Priority 4: Redis Adapter (LOW - Only if scaling)

### When to implement
- When you need multiple server instances
- When you expect > 100 concurrent users
- When you need high availability

### Implementation
```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

### Cost Consideration
- Redis Cloud Free Tier: 30MB (enough for ~1000 concurrent users)
- Upstash Redis: Pay-as-you-go (very cheap for small scale)

---

## Timeline & Effort Estimation

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Break down hook | HIGH | 3-4 weeks | High maintainability |
| Adaptive chunks | MEDIUM | 1 week | Better performance |
| Room security | MEDIUM | 2 days | Better security |
| Redis adapter | LOW | 1 week | Scalability (only if needed) |

---

## Recommendation

### Phase 1 (Now - 1 month)
1. ✅ Break down `usePeerConnection.ts` into services
2. ✅ Add adaptive chunk sizing
3. ✅ Improve room code generation

### Phase 2 (If scaling needed)
1. Add Redis adapter
2. Separate signaling server from Next.js
3. Add comprehensive testing

### Phase 3 (Future)
1. Add monitoring (Sentry, LogRocket)
2. Add analytics
3. Performance optimization

---

## Notes

- **Don't over-engineer early:** PurrDrop is a P2P tool for small groups, not a massive scale app
- **Focus on code quality first:** Clean, maintainable code > premature optimization
- **Test incrementally:** Don't refactor everything at once
- **Keep it simple:** The beauty of PurrDrop is its simplicity

---

**Target Deployment Scale:** Small to medium (10-100 concurrent users)
**Current Priority:** Code quality > Scalability
**Next Step:** Start with SignalingService extraction
