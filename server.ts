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

  io.on('connection', (socket: Socket) => {
    if (peers.size >= MAX_PEERS) {
      socket.emit('server-full', { message: 'เซิร์ฟเวอร์เต็ม กรุณาลองใหม่อีกครั้ง' });
      socket.disconnect();
      return;
    }
    
    if (dev) console.log(`✅ Client connected: ${socket.id}`);
    console.log(`📡 Registered events: join, set-mode, rtc-*, file-*, relay-*, text-offer, disconnect`);

    socket.on('join', (peerData: Peer) => {
      if (dev) console.log(`📥 Join event received:`, peerData);
      
      const peer: PeerWithMode = {
        ...peerData,
        id: socket.id,
        mode: 'public',
        ip: (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || socket.handshake.address
      };
      
      peers.set(socket.id, peer);
      console.log(`👤 Peer joined: ${peer.name} (${peer.device}) - Total peers: ${peers.size}`);
      
      // Send current mode info
      socket.emit('mode-info', {
        mode: peer.mode,
        roomCode: null,
        roomPassword: null
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
      io.to(to).emit('rtc-offer', {
        from: socket.id,
        offer
      });
    });

    socket.on('rtc-answer', ({ to, answer }: { to: string; answer: RTCSessionDescriptionInit }) => {
      io.to(to).emit('rtc-answer', {
        from: socket.id,
        answer
      });
    });

    socket.on('rtc-ice', ({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
      io.to(to).emit('rtc-ice', {
        from: socket.id,
        candidate
      });
    });

    // File transfer signaling
    socket.on('file-offer', ({ to, file, fileId }: { to: string; file: { name: string; size: number; type: string }; fileId: string }) => {
      const fromPeer = peers.get(socket.id);
      if (!fromPeer) return;
      
      io.to(to).emit('file-offer', {
        from: fromPeer,
        file,
        fileId
      });
    });

    socket.on('file-accept', ({ to, fileId }: { to: string; fileId: string }) => {
      io.to(to).emit('file-accept', {
        from: socket.id,
        fileId
      });
    });

    socket.on('file-reject', ({ to, fileId }: { to: string; fileId: string }) => {
      io.to(to).emit('file-reject', {
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

    // Throttle relay chunks เพื่อลด CPU/bandwidth
    let lastRelayTime = 0;
    socket.on('relay-chunk', ({ to, fileId, chunk }: { to: string; fileId: string; chunk: ArrayBuffer }) => {
      // Don't forward chunks for rejected relays
      if (rejectedRelays.has(fileId)) {
        return;
      }
      
      // Throttle เพื่อไม่ให้ server ทำงานหนักเกินไป
      const now = Date.now();
      if (now - lastRelayTime < RELAY_CHUNK_THROTTLE) {
        // Skip this chunk if too fast (client will retry)
        return;
      }
      lastRelayTime = now;
      
      // Forward ทันที - ใช้ memory แค่ชั่วขณะ แล้ว GC ทิ้งทันที
      io.to(to).emit('relay-chunk', {
        fileId,
        chunk
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
      
      io.to(to).emit('relay-end', {
        fileId
      });
    });

    // Text message
    socket.on('text-offer', ({ to, text }: { to: string; text: string }) => {
      if (typeof text !== 'string' || text.length > 1_000_000) {
        socket.emit('text-error', { error: 'ข้อความใหญ่เกินไป (สูงสุด 1MB)' });
        return;
      }
      
      const fromPeer = peers.get(socket.id);
      if (!fromPeer) return;
      
      io.to(to).emit('text-offer', {
        from: fromPeer,
        text,
        timestamp: Date.now()
      });
    });

    socket.on('disconnect', (reason) => {
      const peer = peers.get(socket.id);
      if (dev) console.log(`❌ Client disconnected: ${socket.id} - Reason: ${reason} - Had peer data: ${!!peer}`);
      
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
}).catch((err) => {
  console.error('❌ Error starting server:', err);
  process.exit(1);
});
