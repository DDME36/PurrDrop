import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

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
  const httpServer = createServer(handler);
  
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const peers = new Map<string, PeerWithMode>();
  const rooms = new Map<string, Set<string>>();

  io.on('connection', (socket: Socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    socket.on('join', (peerData: Peer) => {
      console.log(`📥 Join event received:`, peerData);
      
      const peer: PeerWithMode = {
        ...peerData,
        id: socket.id,
        mode: 'public',
        ip: socket.handshake.address
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
    socket.on('file-offer', ({ to, file, fileId }: { to: string; file: any; fileId: string }) => {
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

    // Relay fallback
    socket.on('relay-start', ({ to, fileId, name, size, mimeType }: any) => {
      io.to(to).emit('relay-start', {
        from: socket.id,
        fileId,
        name,
        size,
        mimeType
      });
    });

    socket.on('relay-chunk', ({ to, fileId, chunk }: any) => {
      io.to(to).emit('relay-chunk', {
        fileId,
        chunk
      });
    });

    socket.on('relay-end', ({ to, fileId }: any) => {
      io.to(to).emit('relay-end', {
        fileId
      });
    });

    // Text message
    socket.on('text-offer', ({ to, text }: { to: string; text: string }) => {
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
      console.log(`❌ Client disconnected: ${socket.id} - Reason: ${reason} - Had peer data: ${!!peer}`);
      
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
        
        peers.delete(socket.id);
        socket.broadcast.emit('peer-left', socket.id);
        broadcastPeers();
      }
    });

    function broadcastPeers() {
      const peer = peers.get(socket.id);
      if (!peer) {
        console.log(`⚠️ broadcastPeers called but peer ${socket.id} not found`);
        return;
      }

      let visiblePeers: PeerWithMode[] = [];

      if (peer.mode === 'public') {
        visiblePeers = Array.from(peers.values()).filter(p => 
          p.mode === 'public' && p.id !== socket.id
        );
      } else if (peer.mode === 'wifi') {
        visiblePeers = Array.from(peers.values()).filter(p => 
          (p.mode === 'wifi' || p.mode === 'public') && 
          p.ip === peer.ip && 
          p.id !== socket.id
        );
      } else if (peer.mode === 'private' && peer.roomCode) {
        const roomPeers = rooms.get(peer.roomCode);
        if (roomPeers) {
          visiblePeers = Array.from(roomPeers)
            .map(id => peers.get(id))
            .filter((p): p is PeerWithMode => p !== undefined && p.id !== socket.id);
        }
      }

      console.log(`📤 Sending ${visiblePeers.length} visible peers to ${peer.name} (mode: ${peer.mode})`);
      socket.emit('peers', visiblePeers);
    }
  });

  httpServer.listen(port, () => {
    console.log(`🚀 Server running on http://${hostname}:${port}`);
  });
});
