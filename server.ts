import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface PeerData {
  id: string;
  name: string;
  device: string;
  critter: {
    type: string;
    color: string;
    emoji: string;
    os: string;
  };
}

// Peer with multiple sockets (tabs)
interface Peer extends PeerData {
  sockets: Set<string>; // Multiple socket IDs for same user
}

const peers = new Map<string, Peer>();

// Helper: Get peer by socket ID
function getPeerBySocketId(socketId: string): Peer | undefined {
  for (const peer of peers.values()) {
    if (peer.sockets.has(socketId)) {
      return peer;
    }
  }
  return undefined;
}

// Helper: Send to all sockets of a peer
function emitToPeer(io: SocketIOServer, peer: Peer, event: string, data: unknown) {
  peer.sockets.forEach(socketId => {
    io.to(socketId).emit(event, data);
  });
}

// Helper: Broadcast peers list to everyone
function broadcastPeers(io: SocketIOServer) {
  const peerList = Array.from(peers.values()).map(p => ({
    id: p.id,
    name: p.name,
    device: p.device,
    critter: p.critter,
  }));
  
  for (const peer of peers.values()) {
    const others = peerList.filter(p => p.id !== peer.id);
    emitToPeer(io, peer, 'peers', others);
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', (peerData: PeerData) => {
      const existingPeer = peers.get(peerData.id);
      
      if (existingPeer) {
        // Same user, new tab - add socket to existing peer
        existingPeer.sockets.add(socket.id);
        existingPeer.name = peerData.name;
        existingPeer.critter = peerData.critter;
        console.log(`Peer reconnected (new tab): ${peerData.name} (${peerData.id}) - ${existingPeer.sockets.size} tabs`);
      } else {
        // New user
        const peer: Peer = {
          ...peerData,
          sockets: new Set([socket.id]),
        };
        peers.set(peerData.id, peer);
        console.log(`Peer joined: ${peer.name} (${peer.id})`);
      }
      
      // Broadcast updated peer list to everyone
      broadcastPeers(io);
    });

    socket.on('update-name', ({ name }) => {
      const peer = getPeerBySocketId(socket.id);
      if (peer) {
        peer.name = name;
        broadcastPeers(io);
      }
    });

    socket.on('update-emoji', ({ emoji }) => {
      const peer = getPeerBySocketId(socket.id);
      if (peer) {
        peer.critter.emoji = emoji;
        broadcastPeers(io);
      }
    });

    // File transfer signaling
    socket.on('file-offer', (data) => {
      console.log('file-offer:', data.from?.name, '->', data.to, data.file?.name);
      const targetPeer = peers.get(data.to);
      if (targetPeer) {
        // Send to all tabs of target peer
        emitToPeer(io, targetPeer, 'file-offer', {
          from: data.from,
          file: data.file,
          fileId: data.fileId,
        });
      }
    });

    socket.on('file-accept', (data) => {
      const targetPeer = peers.get(data.to);
      const senderPeer = getPeerBySocketId(socket.id);
      if (targetPeer && senderPeer) {
        console.log('file-accept:', senderPeer.name, '->', targetPeer.name);
        emitToPeer(io, targetPeer, 'file-accept', {
          from: senderPeer.id,
          fileId: data.fileId,
        });
      }
    });

    socket.on('file-reject', (data) => {
      const targetPeer = peers.get(data.to);
      if (targetPeer) {
        emitToPeer(io, targetPeer, 'file-reject', {});
      }
    });

    // WebRTC Signaling - send to specific socket only
    socket.on('rtc-offer', (data) => {
      const targetPeer = peers.get(data.to);
      const senderPeer = getPeerBySocketId(socket.id);
      if (targetPeer && senderPeer) {
        // Send to first socket of target (WebRTC is 1-to-1)
        const targetSocketId = Array.from(targetPeer.sockets)[0];
        io.to(targetSocketId).emit('rtc-offer', {
          from: senderPeer.id,
          offer: data.offer,
        });
      }
    });

    socket.on('rtc-answer', (data) => {
      const targetPeer = peers.get(data.to);
      const senderPeer = getPeerBySocketId(socket.id);
      if (targetPeer && senderPeer) {
        const targetSocketId = Array.from(targetPeer.sockets)[0];
        io.to(targetSocketId).emit('rtc-answer', {
          from: senderPeer.id,
          answer: data.answer,
        });
      }
    });

    socket.on('rtc-ice', (data) => {
      const targetPeer = peers.get(data.to);
      const senderPeer = getPeerBySocketId(socket.id);
      if (targetPeer && senderPeer) {
        const targetSocketId = Array.from(targetPeer.sockets)[0];
        io.to(targetSocketId).emit('rtc-ice', {
          from: senderPeer.id,
          candidate: data.candidate,
        });
      }
    });

    socket.on('disconnect', () => {
      const peer = getPeerBySocketId(socket.id);
      if (peer) {
        peer.sockets.delete(socket.id);
        
        if (peer.sockets.size === 0) {
          // All tabs closed - remove peer
          peers.delete(peer.id);
          console.log(`Peer left: ${peer.name} (${peer.id})`);
        } else {
          console.log(`Tab closed: ${peer.name} - ${peer.sockets.size} tabs remaining`);
        }
        
        broadcastPeers(io);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`
🐱 PurrDrop is running!

   Local:   http://localhost:${port}
   Network: http://${getLocalIP()}:${port}

   Open this URL on other devices to start sharing!
    `);
  });
});

function getLocalIP(): string {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}
