import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`🔧 Starting server in ${dev ? 'development' : 'production'} mode on port ${port}...`);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

interface Peer {
  id: string;
  name: string;
  device: string;
  critter: {
    emoji: string;
    name: string;
    color: string;
  };
}

interface PeerWithMode extends Peer {
  mode: 'public' | 'wifi' | 'private';
  roomCode?: string;
  roomPassword?: string;
  ip?: string;
}

app.prepare().then(() => {
  console.log('✅ Next.js prepared, creating HTTP server...');
  
  const httpServer = createServer((req, res) => {
    // Health check endpoint for Render
    if (req.url === '/health' || req.url === '/api/health') {
      const health = {
        status: 'ok',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        peers: peers.size,
        rooms: rooms.size,
        timestamp: new Date().toISOString()
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
      return;
    }
    
    handler(req, res);
  });
  
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1 * 1024 * 1024, // 1MB - ลดลงเพราะใช้ streaming
    perMessageDeflate: false, // ปิด compression เพื่อลด CPU
    httpCompression: false // ปิด HTTP compression
  });

  const peers = new Map<string, PeerWithMode>();
  const rooms = new Map<string, Set<string>>();
  const rejectedRelays = new Set<string>(); // Track rejected relay sessions
  const activeRelays = new Map<string, { startTime: number; from: string; to: string; size: number }>(); // Track active relay sessions
  const MAX_PEERS = 50; // ลดลงเพื่อประหยัด memory
  const MAX_CONCURRENT_RELAYS = 3; // จำกัดจำนวน relay พร้อมกัน
  const RELAY_TIMEOUT = 5 * 60 * 1000; // ลดเหลือ 5 นาที
  const STALE_PEER_INTERVAL = 60 * 1000; // Check for stale peers every 60s
  const RELAY_CHUNK_THROTTLE = 10; // ms - throttle relay chunks

  // Rate limiting: Track events per socket (Memory-efficient for Free Tier)
  // Only track recent events, auto-cleanup old entries
  const rateLimitMap = new Map<string, { 
    join: number; // Last join timestamp
    fileOffer: number; // Last file offer timestamp
    rtcOffer: number; // Last RTC offer timestamp
    joinCount: number; // Count in current window
    fileOfferCount: number;
    rtcOfferCount: number;
  }>();
  
  const RATE_LIMITS = {
    join: { max: 3, window: 60000 }, // 3 joins per minute (reduced for free tier)
    fileOffer: { max: 5, window: 60000 }, // 5 file offers per minute (reduced)
    rtcOffer: { max: 10, window: 60000 }, // 10 RTC offers per minute (reduced)
  };

  // Rate limit checker (Memory-efficient version)
  function checkRateLimit(socketId: string, eventType: 'join' | 'fileOffer' | 'rtcOffer'): boolean {
    const now = Date.now();
    let limits = rateLimitMap.get(socketId);
    
    if (!limits) {
      limits = { 
        join: now, 
        fileOffer: now, 
        rtcOffer: now,
        joinCount: 0,
        fileOfferCount: 0,
        rtcOfferCount: 0
      };
      rateLimitMap.set(socketId, limits);
    }
    
    const config = RATE_LIMITS[eventType];
    const lastTime = limits[eventType];
    const countKey = `${eventType}Count` as keyof typeof limits;
    
    // Reset counter if window expired
    if (now - lastTime > config.window) {
      limits[eventType] = now;
      limits[countKey] = 1;
      return true;
    }
    
    // Check if limit exceeded
    if (limits[countKey] >= config.max) {
      console.warn(`⚠️ Rate limit exceeded for ${socketId}: ${eventType}`);
      return false;
    }
    
    // Increment counter
    limits[countKey]++;
    return true;
  }
  
  // Clean up rate limit map periodically (prevent memory leak)
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [socketId, limits] of rateLimitMap.entries()) {
      // Remove if all windows expired and socket not connected
      const allExpired = 
        (now - limits.join > RATE_LIMITS.join.window) &&
        (now - limits.fileOffer > RATE_LIMITS.fileOffer.window) &&
        (now - limits.rtcOffer > RATE_LIMITS.rtcOffer.window);
      
      if (allExpired && !io.sockets.sockets.has(socketId)) {
        rateLimitMap.delete(socketId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} rate limit entries`);
    }
  }, 5 * 60 * 1000); // Clean every 5 minutes

  // Helper: Find socket.id from peer.id
  function findSocketIdByPeerId(peerId: string): string | null {
    for (const [socketId, peer] of peers.entries()) {
      if (peer.id === peerId) {
        return socketId;
      }
    }
    return null;
  }

  io.on('connection', (socket: Socket) => {
    if (peers.size >= MAX_PEERS) {
      socket.emit('server-full', { message: 'เซิร์ฟเวอร์เต็ม กรุณาลองใหม่อีกครั้ง' });
      socket.disconnect();
      return;
    }
    
    if (dev) console.log(`✅ Client connected: ${socket.id}`);
    console.log(`📡 Registered events: join, set-mode, rtc-*, file-*, relay-*, text-offer, disconnect`);

    socket.on('join', (peerData: Peer) => {
      // Rate limiting
      if (!checkRateLimit(socket.id, 'join')) {
        socket.emit('rate-limit-exceeded', { 
          event: 'join', 
          message: 'คุณพยายามเชื่อมต่อบ่อยเกินไป กรุณารอสักครู่' 
        });
        return;
      }
      
      if (dev) console.log(`📥 Join event received:`, peerData);
      
      // Fix Double Users: Check if this peer ID already exists
      for (const [existingSocketId, existingPeer] of peers.entries()) {
        if (existingPeer.id === peerData.id && existingSocketId !== socket.id) {
          console.log(`🔄 Duplicate peer detected (${peerData.name}), disconnecting old socket: ${existingSocketId}`);
          const oldSocket = io.sockets.sockets.get(existingSocketId);
          if (oldSocket) {
            oldSocket.emit('force-disconnect', { reason: 'เปิดใช้งานในแท็บใหม่' });
            oldSocket.disconnect();
          }
          peers.delete(existingSocketId);
        }
      }
      
      const clientIp = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || socket.handshake.address;
      
      const peer: PeerWithMode = {
        ...peerData,
        // Keep the original peerData.id (from client localStorage) as the unique ID
        // but the map key remains socket.id for communication
        mode: 'public',
        ip: clientIp
      };
      
      peers.set(socket.id, peer);
      console.log(`👤 Peer joined: ${peer.name} (${peer.device}) - IP: ${clientIp} - Total peers: ${peers.size}`);
      
      // Mask IP for network name (e.g., 1.2.3.4 -> 1.2.3.x)
      const maskedIp = clientIp.includes('.') 
        ? clientIp.split('.').slice(0, 3).join('.') + '.x'
        : clientIp.split(':').slice(0, 3).join(':') + ':x';

      // Send current mode info
      socket.emit('mode-info', {
        mode: peer.mode,
        roomCode: null,
        roomPassword: null,
        networkName: maskedIp
      });
      
      // Broadcast to all peers
      broadcastPeers();
      
      // Notify others
      socket.broadcast.emit('peer-joined', peer);
    });

    socket.on('set-mode', ({ mode, roomCode, password }: { mode: 'public' | 'wifi' | 'private'; roomCode?: string; password?: string }) => {
      const peer = peers.get(socket.id);
      if (!peer) return;

      // Leave previous room if any
      if (peer.roomCode) {
        socket.leave(peer.roomCode);
        rooms.get(peer.roomCode)?.delete(socket.id);
        if (rooms.get(peer.roomCode)?.size === 0) {
          rooms.delete(peer.roomCode);
        }
      }

      peer.mode = mode;
      peer.roomCode = roomCode;
      peer.roomPassword = password;

      if (mode === 'private' && roomCode) {
        // Check password if room exists
        const existingRoom = rooms.get(roomCode);
        if (existingRoom && existingRoom.size > 0) {
          const firstPeerId = Array.from(existingRoom)[0];
          const firstPeer = peers.get(firstPeerId);
          if (firstPeer?.roomPassword && firstPeer.roomPassword !== password) {
            socket.emit('room-error', {
              error: 'wrong-password',
              message: 'รหัสผ่านไม่ถูกต้อง'
            });
            return;
          }
        }

        socket.join(roomCode);
        if (!rooms.has(roomCode)) {
          rooms.set(roomCode, new Set());
        }
        rooms.get(roomCode)!.add(socket.id);
        
        socket.emit('room-info', { roomCode });
      }

      socket.emit('mode-info', {
        mode,
        roomCode: mode === 'private' ? roomCode : null,
        roomPassword: mode === 'private' ? password : null,
        networkName: mode === 'wifi' ? peer.ip : undefined
      });

      broadcastPeers();
      socket.broadcast.emit('peer-updated', peer);
    });

    // WebRTC signaling
    socket.on('rtc-offer', ({ to, offer }: { to: string; offer: RTCSessionDescriptionInit }) => {
      // Rate limiting
      if (!checkRateLimit(socket.id, 'rtcOffer')) {
        console.warn(`⚠️ Rate limit exceeded for rtc-offer from ${socket.id}`);
        return;
      }
      
      const targetSocketId = findSocketIdByPeerId(to);
      if (!targetSocketId) {
        console.error(`❌ rtc-offer: Target peer not found: ${to}`);
        return;
      }
      
      io.to(targetSocketId).emit('rtc-offer', {
        from: socket.id,
        offer
      });
    });

    socket.on('rtc-answer', ({ to, answer }: { to: string; answer: RTCSessionDescriptionInit }) => {
      const targetSocketId = findSocketIdByPeerId(to);
      if (!targetSocketId) {
        console.error(`❌ rtc-answer: Target peer not found: ${to}`);
        return;
      }
      
      io.to(targetSocketId).emit('rtc-answer', {
        from: socket.id,
        answer
      });
    });

    socket.on('rtc-ice', ({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
      const targetSocketId = findSocketIdByPeerId(to);
      if (!targetSocketId) {
        console.error(`❌ rtc-ice: Target peer not found: ${to}`);
        return;
      }
      
      io.to(targetSocketId).emit('rtc-ice', {
        from: socket.id,
        candidate
      });
    });

    // File transfer signaling
    socket.on('file-offer', ({ to, file, fileId }: { to: string; file: { name: string; size: number; type: string }; fileId: string }) => {
      // Rate limiting
      if (!checkRateLimit(socket.id, 'fileOffer')) {
        socket.emit('rate-limit-exceeded', { 
          event: 'file-offer', 
          message: 'คุณส่งไฟล์บ่อยเกินไป กรุณารอสักครู่' 
        });
        return;
      }
      
      // Payload validation
      if (!file || !file.name || typeof file.size !== 'number' || !fileId) {
        console.error('❌ Invalid file-offer payload');
        socket.emit('file-error', { error: 'ข้อมูลไฟล์ไม่ถูกต้อง' });
        return;
      }
      
      // File size validation (max 2GB)
      if (file.size > 2 * 1024 * 1024 * 1024) {
        socket.emit('file-error', { error: 'ไฟล์ใหญ่เกิน 2GB' });
        return;
      }
      
      const fromPeer = peers.get(socket.id);
      if (!fromPeer) return;
      
      const targetSocketId = findSocketIdByPeerId(to);
      if (!targetSocketId) {
        console.error(`❌ file-offer: Target peer not found: ${to}`);
        socket.emit('file-error', { error: 'ผู้รับไม่ได้เชื่อมต่ออยู่' });
        return;
      }
      
      console.log(`📤 Forwarding file-offer: ${file.name} from ${fromPeer.name} to ${targetSocketId}`);
      
      io.to(targetSocketId).emit('file-offer', {
        from: fromPeer,
        file,
        fileId
      });
    });

    socket.on('file-accept', ({ to, fileId }: { to: string; fileId: string }) => {
      const targetSocketId = findSocketIdByPeerId(to);
      if (!targetSocketId) {
        console.error(`❌ file-accept: Target peer not found: ${to}`);
        return;
      }
      
      console.log(`✅ Forwarding file-accept from ${socket.id} to ${targetSocketId}`);
      
      io.to(targetSocketId).emit('file-accept', {
        from: socket.id,
        fileId
      });
    });

    socket.on('file-reject', ({ to, fileId }: { to: string; fileId: string }) => {
      const targetSocketId = findSocketIdByPeerId(to);
      if (!targetSocketId) {
        console.error(`❌ file-reject: Target peer not found: ${to}`);
        return;
      }
      
      console.log(`❌ Forwarding file-reject from ${socket.id} to ${targetSocketId}`);
      
      io.to(targetSocketId).emit('file-reject', {
        from: socket.id,
        fileId
      });
    });

    // Relay fallback - Streaming mode (ไม่เก็บใน memory)
    socket.on('relay-start', ({ to, fileId, name, size, mimeType }: { to: string; fileId: string; name: string; size: number; mimeType: string }) => {
      console.log(`📤 Relay-start received: ${name} (${(size / 1024 / 1024).toFixed(1)}MB) from ${socket.id} to ${to}`);
      
      // Check if receiver is still connected
      const receiverSocket = io.sockets.sockets.get(to);
      if (!receiverSocket) {
        console.error(`❌ Relay rejected: Receiver ${to} not connected`);
        socket.emit('relay-error', { 
          fileId, 
          error: 'ผู้รับไม่ได้เชื่อมต่ออยู่',
          suggestedAction: 'รอให้ผู้รับเชื่อมต่อก่อน'
        });
        return;
      }

      // จำกัดจำนวน relay พร้อมกัน (ป้องกัน server ล่ม)
      if (activeRelays.size >= MAX_CONCURRENT_RELAYS) {
        console.error(`❌ Relay rejected: Too many concurrent relays (${activeRelays.size}/${MAX_CONCURRENT_RELAYS})`);
        socket.emit('relay-error', { 
          fileId, 
          error: 'เซิร์ฟเวอร์กำลังส่งไฟล์เต็มแล้ว กรุณารอสักครู่',
          suggestedAction: 'ลองใหม่อีกครั้งใน 1-2 นาที หรือใช้ WiFi เดียวกันเพื่อส่งตรง P2P'
        });
        return;
      }

      // แนะนำให้ใช้ P2P สำหรับไฟล์ใหญ่
      if (size > 50 * 1024 * 1024) { // > 50MB
        console.warn(`⚠️ Large file relay: ${(size / 1024 / 1024).toFixed(1)}MB - suggesting P2P`);
        socket.emit('relay-warning', {
          fileId,
          message: 'ไฟล์ใหญ่กว่า 50MB แนะนำให้ใช้ WiFi เดียวกันเพื่อส่งเร็วขึ้น',
          size
        });
      }
      
      // Track active relay session
      activeRelays.set(fileId, { startTime: Date.now(), from: socket.id, to, size });
      console.log(`📊 Active relays: ${activeRelays.size}`);
      
      // Forward ทันที ไม่เก็บใน memory (streaming mode)
      console.log(`✅ Forwarding relay-start to ${to}`);
      io.to(to).emit('relay-start', {
        from: socket.id,
        fileId,
        name,
        size,
        mimeType
      });
    });

    socket.on('relay-ready', ({ to, fileId }: { to: string; fileId: string }) => {
      console.log(`✅ Forwarding relay-ready ACK from ${socket.id} to ${to} for file ${fileId}`);
      io.to(to).emit('relay-ready', {
        from: socket.id,
        fileId
      });
    });

    socket.on('relay-chunk', ({ to, fileId, chunk }: { to: string; fileId: string; chunk: ArrayBuffer }, ack?: (success: boolean) => void) => {
      // Don't forward chunks for rejected relays
      if (rejectedRelays.has(fileId)) {
        if (ack) ack(false);
        return;
      }
      
      // Render Free Tier: Limit chunk size to prevent memory overflow
      const MAX_CHUNK_SIZE = 128 * 1024; // 128KB max per chunk
      if (chunk.byteLength > MAX_CHUNK_SIZE) {
        console.error(`❌ Relay chunk too large: ${chunk.byteLength} bytes (max ${MAX_CHUNK_SIZE})`);
        socket.emit('relay-error', { 
          fileId, 
          error: 'Chunk size เกินขนาดที่กำหนด',
          suggestedAction: 'ลดขนาด chunk หรือใช้ P2P แทน'
        });
        if (ack) ack(false);
        return;
      }
      
      // Backpressure: Check if receiver socket is still connected and not overwhelmed
      const receiverSocket = io.sockets.sockets.get(to);
      if (!receiverSocket || !receiverSocket.connected) {
        console.error(`❌ Relay chunk dropped: Receiver ${to} not connected`);
        if (ack) ack(false);
        return;
      }
      
      // Forward chunk with acknowledgment for backpressure control
      receiverSocket.emit('relay-chunk', { fileId, chunk }, (receiverAck: boolean) => {
        // Receiver confirms it processed the chunk
        if (ack) ack(receiverAck !== false);
      });
    });

    socket.on('relay-end', ({ to, fileId }: { to: string; fileId: string }) => {
      // Don't forward end for rejected relays
      if (rejectedRelays.has(fileId)) {
        console.log(`🚫 Ignoring relay-end for rejected fileId: ${fileId}`);
        rejectedRelays.delete(fileId); // Clean up
        return;
      }
      
      // Clean up relay tracking
      const relayInfo = activeRelays.get(fileId);
      if (relayInfo) {
        const duration = ((Date.now() - relayInfo.startTime) / 1000).toFixed(1);
        console.log(`✅ Relay complete: ${fileId} (${duration}s, ${(relayInfo.size / 1024 / 1024).toFixed(1)}MB)`);
        activeRelays.delete(fileId);
      } else {
        console.log(`✅ Relay-end: ${fileId} from ${socket.id} to ${to}`);
      }
      
      // Delay relay-end slightly to ensure all chunks arrive first
      // This prevents "unexpected end of archive" errors
      setTimeout(() => {
        io.to(to).emit('relay-end', { fileId });
      }, 100);
    });

    // Text message
    socket.on('text-offer', ({ to, text }: { to: string; text: string }) => {
      // Payload validation
      if (typeof text !== 'string' || text.length > 1_000_000) {
        socket.emit('text-error', { error: 'ข้อความใหญ่เกินไป (สูงสุด 1MB)' });
        return;
      }
      
      if (!to || typeof to !== 'string') {
        socket.emit('text-error', { error: 'ข้อมูลผู้รับไม่ถูกต้อง' });
        return;
      }
      
      const fromPeer = peers.get(socket.id);
      if (!fromPeer) return;
      
      const targetSocketId = findSocketIdByPeerId(to);
      if (!targetSocketId) {
        console.error(`❌ text-offer: Target peer not found: ${to}`);
        socket.emit('text-error', { error: 'ผู้รับไม่ได้เชื่อมต่ออยู่' });
        return;
      }
      
      console.log(`💬 Forwarding text from ${fromPeer.name} to ${targetSocketId}`);
      
      io.to(targetSocketId).emit('text-offer', {
        from: fromPeer,
        text,
        timestamp: Date.now()
      });
    });

    socket.on('disconnect', (reason) => {
      const peer = peers.get(socket.id);
      if (dev) console.log(`❌ Client disconnected: ${socket.id} - Reason: ${reason} - Had peer data: ${!!peer}`);
      
      // Clean up rate limit tracking
      rateLimitMap.delete(socket.id);
      
      if (peer) {
        console.log(`👋 Peer left: ${peer.name} - Remaining peers: ${peers.size - 1}`);
        
        // Leave room if in one
        if (peer.roomCode) {
          socket.leave(peer.roomCode);
          rooms.get(peer.roomCode)?.delete(socket.id);
          if (rooms.get(peer.roomCode)?.size === 0) {
            rooms.delete(peer.roomCode);
          }
        }
        
        // Clean up any active relays involving this peer
        for (const [fileId, relay] of activeRelays.entries()) {
          if (relay.from === socket.id || relay.to === socket.id) {
            console.log(`🧹 Cleaning up abandoned relay: ${fileId}`);
            // Notify the other side that the transfer failed
            const otherSide = relay.from === socket.id ? relay.to : relay.from;
            io.to(otherSide).emit('relay-error', {
              fileId,
              error: 'ผู้ส่ง/ผู้รับตัดการเชื่อมต่อระหว่างการส่งไฟล์',
              suggestedAction: 'กรุณาลองส่งใหม่อีกครั้ง'
            });
            activeRelays.delete(fileId);
          }
        }
        
        peers.delete(socket.id);
        socket.broadcast.emit('peer-left', socket.id);
        
        // Broadcast updated peer lists to ALL remaining peers
        broadcastPeersToAll();
      }
    });

    // Per-socket broadcastPeers — sends filtered peer list to THIS socket only
    function broadcastPeers() {
      const peer = peers.get(socket.id);
      if (!peer) {
        // Not a bug — this can happen on disconnect, use broadcastPeersToAll instead
        return;
      }

      const visiblePeers = getVisiblePeersFor(peer);
      if (dev) console.log(`📤 Sending ${visiblePeers.length} visible peers to ${peer.name} (mode: ${peer.mode})`);
      socket.emit('peers', visiblePeers);
    }
  });

  // ─── Helper: Get visible peers for a given peer ───
  function getVisiblePeersFor(peer: PeerWithMode): PeerWithMode[] {
    if (peer.mode === 'public') {
      return Array.from(peers.values()).filter(p => 
        p.mode === 'public' && p.id !== peer.id
      );
    } else if (peer.mode === 'wifi') {
      return Array.from(peers.values()).filter(p => 
        (p.mode === 'wifi' || p.mode === 'public') && 
        p.ip === peer.ip && 
        p.id !== peer.id
      );
    } else if (peer.mode === 'private' && peer.roomCode) {
      const roomPeers = rooms.get(peer.roomCode);
      if (roomPeers) {
        return Array.from(roomPeers)
          .map(id => peers.get(id))
          .filter((p): p is PeerWithMode => p !== undefined && p.id !== peer.id);
      }
    }
    return [];
  }

  // ─── Broadcast updated peer lists to ALL connected peers ───
  function broadcastPeersToAll() {
    for (const [socketId, peer] of peers.entries()) {
      const visiblePeers = getVisiblePeersFor(peer);
      io.to(socketId).emit('peers', visiblePeers);
    }
    if (dev) console.log(`📤 Broadcast peer lists to ${peers.size} peers`);
  }

  // ─── Stale peer cleanup (every 60s) ───
  setInterval(() => {
    let cleaned = 0;
    for (const [socketId, peer] of peers.entries()) {
      const s = io.sockets.sockets.get(socketId);
      if (!s || !s.connected) {
        console.log(`🧹 Removing stale peer: ${peer.name} (${socketId})`);
        // Clean up room membership
        if (peer.roomCode) {
          rooms.get(peer.roomCode)?.delete(socketId);
          if (rooms.get(peer.roomCode)?.size === 0) {
            rooms.delete(peer.roomCode);
          }
        }
        peers.delete(socketId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} stale peers. Remaining: ${peers.size}`);
      broadcastPeersToAll();
    }

    // Clean up timed-out relay sessions
    const now = Date.now();
    for (const [fileId, relay] of activeRelays.entries()) {
      if (now - relay.startTime > RELAY_TIMEOUT) {
        console.log(`⏱️ Relay timeout: ${fileId} (${((now - relay.startTime) / 1000 / 60).toFixed(1)} min)`);
        // Notify both sides
        io.to(relay.from).emit('relay-error', { fileId, error: 'การส่งไฟล์หมดเวลา (10 นาที)', suggestedAction: 'ลองส่งใหม่อีกครั้ง' });
        io.to(relay.to).emit('relay-error', { fileId, error: 'การรับไฟล์หมดเวลา (10 นาที)', suggestedAction: 'ลองส่งใหม่อีกครั้ง' });
        activeRelays.delete(fileId);
      }
    }
  }, STALE_PEER_INTERVAL);

  // ─── Keep-Alive for Render Free Tier (prevent sleep) ───
  // Render Free Tier sleeps after 15 minutes of inactivity
  // Send keep-alive every 14 minutes to prevent sleep
  const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes
  setInterval(() => {
    const clientCount = io.engine.clientsCount;
    if (clientCount > 0) {
      io.emit('server-keep-alive', { timestamp: Date.now() });
      console.log(`💓 Keep-alive sent to ${clientCount} clients (prevent Render sleep)`);
    } else {
      console.log('💤 No clients connected, allowing Render to sleep');
    }
  }, KEEP_ALIVE_INTERVAL);

  httpServer.listen(port, hostname, () => {
    console.log(`🚀 Server running on http://${hostname}:${port}`);
    console.log(`✅ Ready to accept connections`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM received, shutting down gracefully...');
    io.emit('server-shutdown', { reason: 'Server is restarting' });
    
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.log('⚠️ Forcing shutdown');
      process.exit(0);
    }, 10000);
  });

  process.on('SIGINT', () => {
    console.log('⚠️ SIGINT received, shutting down...');
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    console.error('Stack:', err.stack);
    
    // Attempt graceful shutdown
    io.emit('server-shutdown', { reason: 'Server error - restarting' });
    
    setTimeout(() => {
      console.log('⚠️ Forcing shutdown after uncaught exception');
      process.exit(1);
    }, 5000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    // Don't exit on unhandled rejection, just log it
  });
}).catch((err) => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});
