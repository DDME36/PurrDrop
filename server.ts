import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

type DiscoveryMode = 'public' | 'wifi' | 'private';

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

interface Peer extends PeerData {
  sockets: Set<string>;
  publicIP: string;
  mode: DiscoveryMode;
  roomCode: string | null;
}

// All connected peers
const peers = new Map<string, Peer>();

// Room code -> Set of peer IDs
const rooms = new Map<string, Set<string>>();

// Generate 5-digit room code
function generateRoomCode(): string {
  let code: string;
  do {
    code = Math.floor(10000 + Math.random() * 90000).toString();
  } while (rooms.has(code) && rooms.get(code)!.size > 0);
  return code;
}

// Get client's real IP
function getClientIP(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  
  let ip = socket.handshake.address || 'unknown';
  
  // Normalize localhost variants to a common value
  if (ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '127.0.0.1') {
    return 'localhost';
  }
  
  // Remove IPv6 prefix if present
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  return ip;
}

// For WiFi mode: use full Public IP for matching
// On cloud (Render), devices on same WiFi share the same Public IP
// This replaces the old subnet-based matching which only works locally
function getWiFiGroupId(ip: string): string {
  // Use full IP as group identifier
  // Devices on same WiFi network will have same Public IP
  return ip;
}

// Get peer by socket ID
function getPeerBySocketId(socketId: string): Peer | undefined {
  for (const peer of peers.values()) {
    if (peer.sockets.has(socketId)) {
      return peer;
    }
  }
  return undefined;
}

// Send to all sockets of a peer
function emitToPeer(io: SocketIOServer, peer: Peer, event: string, data: unknown) {
  peer.sockets.forEach(socketId => {
    io.to(socketId).emit(event, data);
  });
}

// Get peers visible to a specific peer based on their mode
function getVisiblePeers(peer: Peer): Peer[] {
  const visible: Peer[] = [];
  const peerWiFiGroup = getWiFiGroupId(peer.publicIP);
  
  for (const otherPeer of peers.values()) {
    if (otherPeer.id === peer.id) continue;
    
    let canSee = false;
    
    switch (peer.mode) {
      case 'public':
        // See everyone in public mode
        canSee = otherPeer.mode === 'public';
        break;
        
      case 'wifi':
        // See only same Public IP (same WiFi network) who are also in wifi mode
        // On cloud deployment, devices on same WiFi share the same Public IP
        const otherWiFiGroup = getWiFiGroupId(otherPeer.publicIP);
        canSee = otherPeer.mode === 'wifi' && otherWiFiGroup === peerWiFiGroup;
        break;
        
      case 'private':
        // See only same room code
        canSee = otherPeer.mode === 'private' && 
                 peer.roomCode !== null && 
                 otherPeer.roomCode === peer.roomCode;
        break;
    }
    
    if (canSee) {
      visible.push(otherPeer);
    }
  }
  
  return visible;
}

// Broadcast peers list to affected peers
function broadcastPeers(io: SocketIOServer) {
  for (const peer of peers.values()) {
    const visiblePeers = getVisiblePeers(peer).map(p => ({
      id: p.id,
      name: p.name,
      device: p.device,
      critter: p.critter,
    }));
    
    emitToPeer(io, peer, 'peers', visiblePeers);
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
    const clientIP = getClientIP(socket);
    console.log('Client connected:', socket.id, 'IP:', clientIP);

    socket.on('join', (peerData: PeerData) => {
      try {
        if (!peerData || !peerData.id || !peerData.name) {
          console.error('Invalid peer data received');
          return;
        }

        const existingPeer = peers.get(peerData.id);
        
        if (existingPeer) {
          // Same user, new tab
          existingPeer.sockets.add(socket.id);
          existingPeer.name = peerData.name;
          existingPeer.critter = peerData.critter;
          console.log(`Peer reconnected: ${peerData.name} (${peerData.id}) IP: ${clientIP}`);
          
          // Send current mode info to new tab
          emitToPeer(io, existingPeer, 'mode-info', { 
            mode: existingPeer.mode,
            roomCode: existingPeer.roomCode,
          });
        } else {
          // New user - default to public mode
          const peer: Peer = {
            ...peerData,
            sockets: new Set([socket.id]),
            publicIP: clientIP,
            mode: 'public',
            roomCode: null,
          };
          peers.set(peerData.id, peer);
          
          console.log(`Peer joined: ${peer.name} (${peer.id}) IP: ${clientIP} Mode: public`);
          
          // Send mode info to client
          emitToPeer(io, peer, 'mode-info', { 
            mode: 'public',
            roomCode: null,
          });
        }
        
        broadcastPeers(io);
      } catch (err) {
        console.error('Error in join handler:', err);
      }
    });

    // Change discovery mode
    socket.on('set-mode', ({ mode, roomCode }: { mode: DiscoveryMode; roomCode?: string }) => {
      try {
        const peer = getPeerBySocketId(socket.id);
        if (!peer) return;
        
        // Validate mode
        if (!['public', 'wifi', 'private'].includes(mode)) {
          console.error('Invalid mode:', mode);
          return;
        }
        
        const oldMode = peer.mode;
        const oldRoom = peer.roomCode;
        
        // Leave old room if was in private mode
        if (oldMode === 'private' && oldRoom && rooms.has(oldRoom)) {
          rooms.get(oldRoom)!.delete(peer.id);
          if (rooms.get(oldRoom)!.size === 0) {
            rooms.delete(oldRoom);
          }
        }
        
        // Set new mode
        peer.mode = mode;
        
        if (mode === 'private') {
          // Validate room code if provided
          const code = (roomCode && /^\d{5}$/.test(roomCode)) ? roomCode : generateRoomCode();
          peer.roomCode = code;
          
          if (!rooms.has(code)) {
            rooms.set(code, new Set());
          }
          rooms.get(code)!.add(peer.id);
          
          console.log(`${peer.name} switched to private mode, room: ${code}`);
        } else {
          peer.roomCode = null;
          console.log(`${peer.name} switched to ${mode} mode`);
        }
        
        // Send confirmation
        emitToPeer(io, peer, 'mode-info', { 
          mode: peer.mode,
          roomCode: peer.roomCode,
        });
        
        broadcastPeers(io);
      } catch (err) {
        console.error('Error in set-mode handler:', err);
      }
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
      try {
        if (!data || !data.to || !data.from || !data.file) {
          console.error('Invalid file-offer data');
          return;
        }
        const targetPeer = peers.get(data.to);
        if (targetPeer) {
          emitToPeer(io, targetPeer, 'file-offer', {
            from: data.from,
            file: data.file,
            fileId: data.fileId,
          });
        }
      } catch (err) {
        console.error('Error in file-offer handler:', err);
      }
    });

    socket.on('file-accept', (data) => {
      try {
        if (!data || !data.to) return;
        const targetPeer = peers.get(data.to);
        const senderPeer = getPeerBySocketId(socket.id);
        if (targetPeer && senderPeer) {
          emitToPeer(io, targetPeer, 'file-accept', {
            from: senderPeer.id,
            fileId: data.fileId,
          });
        }
      } catch (err) {
        console.error('Error in file-accept handler:', err);
      }
    });

    socket.on('file-reject', (data) => {
      try {
        if (!data || !data.to) return;
        const targetPeer = peers.get(data.to);
        if (targetPeer) {
          emitToPeer(io, targetPeer, 'file-reject', {});
        }
      } catch (err) {
        console.error('Error in file-reject handler:', err);
      }
    });

    // WebRTC Signaling
    socket.on('rtc-offer', (data) => {
      try {
        if (!data || !data.to || !data.offer) return;
        const targetPeer = peers.get(data.to);
        const senderPeer = getPeerBySocketId(socket.id);
        if (targetPeer && senderPeer) {
          const targetSocketId = Array.from(targetPeer.sockets)[0];
          if (targetSocketId) {
            io.to(targetSocketId).emit('rtc-offer', {
              from: senderPeer.id,
              offer: data.offer,
            });
          }
        }
      } catch (err) {
        console.error('Error in rtc-offer handler:', err);
      }
    });

    socket.on('rtc-answer', (data) => {
      try {
        if (!data || !data.to || !data.answer) return;
        const targetPeer = peers.get(data.to);
        const senderPeer = getPeerBySocketId(socket.id);
        if (targetPeer && senderPeer) {
          const targetSocketId = Array.from(targetPeer.sockets)[0];
          if (targetSocketId) {
            io.to(targetSocketId).emit('rtc-answer', {
              from: senderPeer.id,
              answer: data.answer,
            });
          }
        }
      } catch (err) {
        console.error('Error in rtc-answer handler:', err);
      }
    });

    socket.on('rtc-ice', (data) => {
      try {
        if (!data || !data.to) return;
        const targetPeer = peers.get(data.to);
        const senderPeer = getPeerBySocketId(socket.id);
        if (targetPeer && senderPeer) {
          const targetSocketId = Array.from(targetPeer.sockets)[0];
          if (targetSocketId && data.candidate) {
            io.to(targetSocketId).emit('rtc-ice', {
              from: senderPeer.id,
              candidate: data.candidate,
            });
          }
        }
      } catch (err) {
        console.error('Error in rtc-ice handler:', err);
      }
    });

    socket.on('disconnect', () => {
      try {
        const peer = getPeerBySocketId(socket.id);
        if (peer) {
          peer.sockets.delete(socket.id);
          
          if (peer.sockets.size === 0) {
            // Remove from room if in private mode
            if (peer.mode === 'private' && peer.roomCode && rooms.has(peer.roomCode)) {
              rooms.get(peer.roomCode)!.delete(peer.id);
              if (rooms.get(peer.roomCode)!.size === 0) {
                rooms.delete(peer.roomCode);
              }
            }
            
            peers.delete(peer.id);
            console.log(`Peer left: ${peer.name} (${peer.id})`);
            
            broadcastPeers(io);
          }
        }
      } catch (err) {
        console.error('Error in disconnect handler:', err);
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
