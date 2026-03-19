import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

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

  interface Peer {
    id: string;
    name: string;
    device: string;
    emoji: string;
    mode: 'public' | 'wifi' | 'private';
    roomCode?: string;
    roomPassword?: string;
    ip?: string;
  }

  const peers = new Map<string, Peer>();
  const rooms = new Map<string, Set<string>>();

  io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    socket.on('register', (data: Peer) => {
      const peer = { ...data, id: socket.id };
      peers.set(socket.id, peer);

      if (peer.mode === 'private' && peer.roomCode) {
        socket.join(peer.roomCode);
        if (!rooms.has(peer.roomCode)) {
          rooms.set(peer.roomCode, new Set());
        }
        rooms.get(peer.roomCode)!.add(socket.id);
      }

      broadcastPeers(socket);
    });

    socket.on('signal', ({ to, signal }) => {
      io.to(to).emit('signal', {
        from: socket.id,
        signal
      });
    });

    socket.on('disconnect', () => {
      const peer = peers.get(socket.id);
      if (peer?.mode === 'private' && peer.roomCode) {
        rooms.get(peer.roomCode)?.delete(socket.id);
        if (rooms.get(peer.roomCode)?.size === 0) {
          rooms.delete(peer.roomCode);
        }
      }
      peers.delete(socket.id);
      broadcastPeers(socket);
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  function broadcastPeers(socket: any) {
    const peer = peers.get(socket.id);
    if (!peer) return;

    let visiblePeers: Peer[] = [];

    if (peer.mode === 'public') {
      visiblePeers = Array.from(peers.values()).filter(p => p.mode === 'public');
    } else if (peer.mode === 'wifi') {
      visiblePeers = Array.from(peers.values()).filter(
        p => (p.mode === 'wifi' || p.mode === 'public') && p.ip === peer.ip
      );
    } else if (peer.mode === 'private' && peer.roomCode) {
      const roomPeers = rooms.get(peer.roomCode);
      if (roomPeers) {
        visiblePeers = Array.from(roomPeers)
          .map(id => peers.get(id))
          .filter((p): p is Peer => p !== undefined);
      }
    }

    socket.emit('peers', visiblePeers.filter(p => p.id !== socket.id));
  }

  httpServer.listen(port, () => {
    console.log(`🚀 Server running on http://${hostname}:${port}`);
  });
});
