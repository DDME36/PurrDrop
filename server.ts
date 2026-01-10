import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface Peer {
  id: string;
  socketId: string;
  name: string;
  device: string;
  critter: {
    type: string;
    color: string;
    emoji: string;
    os: string;
  };
}

const peers = new Map<string, Peer>();

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

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', (peerData: Omit<Peer, 'socketId'>) => {
      const peer: Peer = {
        ...peerData,
        socketId: socket.id,
      };
      
      // Update or add peer
      peers.set(peerData.id, peer);
      
      // Send current peers to new client
      const peerList = Array.from(peers.values()).filter(p => p.id !== peerData.id);
      socket.emit('peers', peerList);
      
      // Notify others
      socket.broadcast.emit('peer-joined', peer);
      
      console.log(`Peer joined: ${peer.name} (${peer.id})`);
    });

    socket.on('update-name', ({ name }) => {
      const peer = Array.from(peers.values()).find(p => p.socketId === socket.id);
      if (peer) {
        peer.name = name;
        socket.broadcast.emit('peer-joined', peer);
      }
    });

    socket.on('update-emoji', ({ emoji }) => {
      const peer = Array.from(peers.values()).find(p => p.socketId === socket.id);
      if (peer) {
        peer.critter.emoji = emoji;
        socket.broadcast.emit('peer-joined', peer);
      }
    });

    // File transfer signaling
    socket.on('file-offer', (data) => {
      console.log('file-offer received:', { to: data.to, from: data.from?.name, fileId: data.fileId, fileName: data.file?.name });
      const targetPeer = peers.get(data.to);
      if (targetPeer) {
        console.log('Forwarding file-offer to:', targetPeer.name, 'socketId:', targetPeer.socketId);
        io.to(targetPeer.socketId).emit('file-offer', {
          from: data.from,
          file: data.file,
          fileId: data.fileId,
        });
      } else {
        console.log('Target peer not found:', data.to);
      }
    });

    socket.on('file-accept', (data) => {
      console.log('file-accept received:', data);
      const targetPeer = peers.get(data.to);
      if (targetPeer) {
        const senderPeer = Array.from(peers.values()).find(p => p.socketId === socket.id);
        console.log('Forwarding file-accept to:', targetPeer.name, 'fileId:', data.fileId);
        io.to(targetPeer.socketId).emit('file-accept', {
          from: senderPeer?.id,
          fileId: data.fileId,
        });
      }
    });

    socket.on('file-reject', (data) => {
      const targetPeer = peers.get(data.to);
      if (targetPeer) {
        io.to(targetPeer.socketId).emit('file-reject', {});
      }
    });

    // WebRTC Signaling
    socket.on('rtc-offer', (data) => {
      const targetPeer = peers.get(data.to);
      if (targetPeer) {
        const senderPeer = Array.from(peers.values()).find(p => p.socketId === socket.id);
        io.to(targetPeer.socketId).emit('rtc-offer', {
          from: senderPeer?.id,
          offer: data.offer,
        });
      }
    });

    socket.on('rtc-answer', (data) => {
      const targetPeer = peers.get(data.to);
      if (targetPeer) {
        const senderPeer = Array.from(peers.values()).find(p => p.socketId === socket.id);
        io.to(targetPeer.socketId).emit('rtc-answer', {
          from: senderPeer?.id,
          answer: data.answer,
        });
      }
    });

    socket.on('rtc-ice', (data) => {
      const targetPeer = peers.get(data.to);
      if (targetPeer) {
        const senderPeer = Array.from(peers.values()).find(p => p.socketId === socket.id);
        io.to(targetPeer.socketId).emit('rtc-ice', {
          from: senderPeer?.id,
          candidate: data.candidate,
        });
      }
    });

    socket.on('disconnect', () => {
      const peer = Array.from(peers.values()).find(p => p.socketId === socket.id);
      if (peer) {
        peers.delete(peer.id);
        socket.broadcast.emit('peer-left', peer.id);
        console.log(`Peer left: ${peer.name} (${peer.id})`);
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
