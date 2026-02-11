import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createHash } from 'crypto';
import { validatePeerData, sanitizeName, validateRoomCode, sanitizePassword } from './src/lib/sanitize';

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
  networkName: string;
  mode: DiscoveryMode;
  roomCode: string | null;
  roomPassword: string | null;
}

// All connected peers
const peers = new Map<string, Peer>();

// Room code -> { peerIds, password }
const rooms = new Map<string, { peerIds: Set<string>; password: string | null }>();

// Generate 5-digit room code
function generateRoomCode(): string {
  let code: string;
  do {
    code = Math.floor(10000 + Math.random() * 90000).toString();
  } while (rooms.has(code) && rooms.get(code)!.peerIds.size > 0);
  return code;
}

// Get local IP address of server
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
  return '127.0.0.1';
}

// Get client's real IP - รองรับ Cloud Provider หลายเจ้า
function getClientIP(socket: Socket): string {
  const headers = socket.handshake.headers;
  
  // ลองหาจาก Header มาตรฐานและของ Cloud เจ้าดังๆ
  // cf-connecting-ip: Cloudflare (แม่นยำสุดถ้าใช้ CF)
  // x-real-ip: Nginx/Reverse Proxy ทั่วไป
  // true-client-ip: Akamai/Cloudflare enterprise
  // x-forwarded-for: มาตรฐาน (อาจมีหลาย IP)
  const ipSource = 
    headers['cf-connecting-ip'] || 
    headers['x-real-ip'] || 
    headers['true-client-ip'] ||
    headers['x-forwarded-for'];
  
  let ip = '';
  
  if (ipSource) {
    // ถ้ามีหลาย IP (proxy1, proxy2, client) เอาตัวแรกสุด
    ip = (typeof ipSource === 'string' ? ipSource : ipSource[0]).split(',')[0].trim();
  } else {
    // ถ้าไม่มี Header ให้เอาจาก connection address
    ip = socket.handshake.address || 'unknown';
  }
  
  // Normalize localhost variants - ใช้ IP จริงของ server แทน
  if (ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '127.0.0.1') {
    // ใช้ IP จริงของ server เพื่อให้ match กับอุปกรณ์อื่นใน WiFi เดียวกัน
    return getLocalIP();
  }
  
  // Remove IPv6 prefix if present (::ffff:)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  return ip;
}

// สร้างชื่อ Network จาก IP (ให้ user เห็นว่าอยู่วงไหน)
function getNetworkName(ip: string): string {
  if (ip === '127.0.0.1' || ip === 'unknown') {
    return 'Local Network';
  }
  
  // สร้าง Hash สั้นๆ จาก IP
  const hash = createHash('md5').update(ip).digest('hex').substring(0, 6);
  
  // แปลงเป็นชื่อ
  const colors = ['Red', 'Blue', 'Green', 'Purple', 'Golden', 'Silver', 'Orange', 'Pink'];
  const animals = ['Dragon', 'Panda', 'Tiger', 'Eagle', 'Shark', 'Bear', 'Wolf', 'Fox'];
  
  const colorIndex = parseInt(hash.substring(0, 2), 16) % colors.length;
  const animalIndex = parseInt(hash.substring(2, 4), 16) % animals.length;
  
  return `${colors[colorIndex]} ${animals[animalIndex]}`;
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

// Convert peer to client-safe format (no internal data)
function peerToClientFormat(p: Peer) {
  return {
    id: p.id,
    name: p.name,
    device: p.device,
    critter: p.critter,
  };
}

// Check if peer A can see peer B based on discovery mode
function canPeerSee(viewer: Peer, target: Peer): boolean {
  if (viewer.id === target.id) return false;
  
  switch (viewer.mode) {
    case 'public':
      return target.mode === 'public';
      
    case 'wifi':
      const viewerGroup = getWiFiGroupId(viewer.publicIP);
      const targetGroup = getWiFiGroupId(target.publicIP);
      return target.mode === 'wifi' && targetGroup === viewerGroup;
      
    case 'private':
      return target.mode === 'private' && 
             viewer.roomCode !== null && 
             target.roomCode === viewer.roomCode;
             
    default:
      return false;
  }
}

// Get peers visible to a specific peer based on their mode
function getVisiblePeers(peer: Peer): Peer[] {
  const visible: Peer[] = [];
  
  for (const otherPeer of peers.values()) {
    if (canPeerSee(peer, otherPeer)) {
      visible.push(otherPeer);
    }
  }
  
  return visible;
}

// Send full peer list to a specific peer (used on initial join or mode change)
function sendFullPeerList(io: SocketIOServer, peer: Peer) {
  const visiblePeers = getVisiblePeers(peer).map(peerToClientFormat);
  emitToPeer(io, peer, 'peers', visiblePeers);
}

// Notify relevant peers when a new peer joins or becomes visible
function notifyPeerJoined(io: SocketIOServer, joinedPeer: Peer) {
  const joinedPeerData = peerToClientFormat(joinedPeer);
  
  for (const viewer of peers.values()) {
    if (canPeerSee(viewer, joinedPeer)) {
      emitToPeer(io, viewer, 'peer-joined', joinedPeerData);
    }
  }
}

// Notify relevant peers when a peer leaves or becomes invisible
function notifyPeerLeft(io: SocketIOServer, leftPeerId: string, affectedViewers: Peer[]) {
  for (const viewer of affectedViewers) {
    emitToPeer(io, viewer, 'peer-left', leftPeerId);
  }
}

// Notify relevant peers when a peer updates their info
function notifyPeerUpdated(io: SocketIOServer, updatedPeer: Peer) {
  const updatedPeerData = peerToClientFormat(updatedPeer);
  
  for (const viewer of peers.values()) {
    if (canPeerSee(viewer, updatedPeer)) {
      emitToPeer(io, viewer, 'peer-updated', updatedPeerData);
    }
  }
}

// Get list of peers who can currently see a specific peer
function getViewersOf(targetPeer: Peer): Peer[] {
  const viewers: Peer[] = [];
  for (const viewer of peers.values()) {
    if (canPeerSee(viewer, targetPeer)) {
      viewers.push(viewer);
    }
  }
  return viewers;
}

// Legacy broadcast - still useful for mode changes where visibility changes drastically
function broadcastPeers(io: SocketIOServer) {
  for (const peer of peers.values()) {
    sendFullPeerList(io, peer);
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? (process.env.ALLOWED_ORIGINS?.split(',') || false)
        : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    const clientIP = getClientIP(socket);
    console.log('Client connected:', socket.id, 'IP:', clientIP);

    socket.on('join', (peerData: PeerData) => {
      try {
        // Validate and sanitize peer data
        const validated = validatePeerData(peerData);
        if (!validated) {
          console.error('Invalid peer data received');
          return;
        }

        const existingPeer = peers.get(validated.id);
        
        if (existingPeer) {
          // Same user, new tab or reconnect
          existingPeer.sockets.add(socket.id);
          existingPeer.name = validated.name;
          existingPeer.critter = validated.critter;
          console.log(`Peer reconnected: ${validated.name} (${validated.id}) IP: ${clientIP}`);
          
          // Send current mode info to new tab
          emitToPeer(io, existingPeer, 'mode-info', { 
            mode: existingPeer.mode,
            roomCode: existingPeer.roomCode,
            roomPassword: existingPeer.roomPassword,
            networkName: existingPeer.networkName,
          });
          
          // Send full peer list to reconnected peer
          sendFullPeerList(io, existingPeer);
          
          // Notify others about updated peer info (emoji/name might have changed)
          notifyPeerUpdated(io, existingPeer);
        } else {
          // New user - default to public mode
          const networkName = getNetworkName(clientIP);
          const peer: Peer = {
            ...validated,
            sockets: new Set([socket.id]),
            publicIP: clientIP,
            networkName,
            mode: 'public',
            roomCode: null,
            roomPassword: null,
          };
          peers.set(peerData.id, peer);
          
          console.log(`[JOIN] ${peer.name} | IP: ${clientIP} | Network: ${networkName}`);
          
          // Send mode info to client
          emitToPeer(io, peer, 'mode-info', { 
            mode: 'public',
            roomCode: null,
            roomPassword: null,
            networkName,
          });
          
          // Send full peer list to new peer
          sendFullPeerList(io, peer);
          
          // Notify others about new peer (delta update)
          // ใช้ setTimeout เพื่อให้ client ได้รับ peers list ก่อน แล้วค่อยส่ง peer-joined
          // ป้องกัน double animation
          setTimeout(() => {
            notifyPeerJoined(io, peer);
          }, 100);
        }
      } catch (err) {
        console.error('Error in join handler:', err);
      }
    });

    // Change discovery mode
    socket.on('set-mode', ({ mode, roomCode, password }: { mode: DiscoveryMode; roomCode?: string; password?: string }) => {
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
          rooms.get(oldRoom)!.peerIds.delete(peer.id);
          if (rooms.get(oldRoom)!.peerIds.size === 0) {
            rooms.delete(oldRoom);
          }
        }
        
        // Set new mode
        peer.mode = mode;
        
        if (mode === 'private') {
          // Validate and sanitize room code and password
          const validatedCode = roomCode ? validateRoomCode(roomCode) : null;
          const sanitizedPassword = password ? sanitizePassword(password) : null;
          
          // Joining existing room with code
          if (validatedCode) {
            const existingRoom = rooms.get(validatedCode);
            
            // ถ้าไม่มีห้องนี้ → แจ้ง error
            if (!existingRoom) {
              console.log(`${peer.name} tried to join non-existent room ${validatedCode}`);
              emitToPeer(io, peer, 'room-error', { 
                error: 'room-not-found',
                message: 'ไม่พบห้องนี้'
              });
              // Revert to public mode
              peer.mode = 'public';
              peer.roomCode = null;
              peer.roomPassword = null;
              emitToPeer(io, peer, 'mode-info', { 
                mode: 'public',
                roomCode: null,
                roomPassword: null,
                networkName: peer.networkName,
              });
              broadcastPeers(io);
              return;
            }
            
            // Check password if room has password
            if (existingRoom.password) {
              if (sanitizedPassword !== existingRoom.password) {
                // Wrong password
                console.log(`${peer.name} failed to join room ${validatedCode} - wrong password`);
                emitToPeer(io, peer, 'room-error', { 
                  error: 'wrong-password',
                  message: 'รหัสผ่านไม่ถูกต้อง'
                });
                // Revert to public mode
                peer.mode = 'public';
                peer.roomCode = null;
                peer.roomPassword = null;
                emitToPeer(io, peer, 'mode-info', { 
                  mode: 'public',
                  roomCode: null,
                  roomPassword: null,
                  networkName: peer.networkName,
                });
                broadcastPeers(io);
                return;
              }
            }
            
            // Join existing room
            peer.roomCode = validatedCode;
            peer.roomPassword = existingRoom.password || null;
            existingRoom.peerIds.add(peer.id);
            
            console.log(`${peer.name} joined room ${validatedCode}${peer.roomPassword ? ' (password protected)' : ''}`);
          } else {
            // Create new room (no code provided = generate new)
            const code = generateRoomCode();
            peer.roomCode = code;
            peer.roomPassword = sanitizedPassword;
            
            rooms.set(code, { 
              peerIds: new Set([peer.id]), 
              password: sanitizedPassword
            });
            
            console.log(`${peer.name} created room ${code}${sanitizedPassword ? ' (password protected)' : ''}`);
          }
            
            // Join existing room
            peer.roomCode = roomCode;
            peer.roomPassword = existingRoom.password || null;
            existingRoom.peerIds.add(peer.id);
            
            console.log(`${peer.name} joined room ${roomCode}${peer.roomPassword ? ' (password protected)' : ''}`);
          } else {
            // Create new room (no code provided = generate new)
            const code = generateRoomCode();
            peer.roomCode = code;
            peer.roomPassword = password || null;
            
            rooms.set(code, { 
              peerIds: new Set([peer.id]), 
              password: password || null 
            });
            
            console.log(`${peer.name} created room ${code}${password ? ' (password protected)' : ''}`);
          }
        } else {
          peer.roomCode = null;
          peer.roomPassword = null;
          console.log(`${peer.name} switched to ${mode} mode`);
        }
        
        // Send confirmation
        emitToPeer(io, peer, 'mode-info', { 
          mode: peer.mode,
          roomCode: peer.roomCode,
          roomPassword: peer.roomPassword,
          networkName: peer.networkName,
        });
        
        broadcastPeers(io);
      } catch (err) {
        console.error('Error in set-mode handler:', err);
      }
    });

    socket.on('update-name', ({ name }) => {
      const peer = getPeerBySocketId(socket.id);
      if (peer) {
        peer.name = sanitizeName(name);
        // Delta update - notify only peers who can see this peer
        notifyPeerUpdated(io, peer);
      }
    });

    socket.on('update-emoji', ({ emoji }) => {
      const peer = getPeerBySocketId(socket.id);
      if (peer && typeof emoji === 'string') {
        // Limit emoji length and sanitize
        peer.critter.emoji = emoji.slice(0, 10);
        // Delta update - notify only peers who can see this peer
        notifyPeerUpdated(io, peer);
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

    // WebRTC Signaling - broadcast to all sockets of peer
    socket.on('rtc-offer', (data) => {
      try {
        if (!data || !data.to || !data.offer) return;
        const targetPeer = peers.get(data.to);
        const senderPeer = getPeerBySocketId(socket.id);
        if (targetPeer && senderPeer) {
          // Send to ALL sockets of target peer (handles multiple tabs)
          emitToPeer(io, targetPeer, 'rtc-offer', {
            from: senderPeer.id,
            offer: data.offer,
          });
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
          // Send to ALL sockets of target peer
          emitToPeer(io, targetPeer, 'rtc-answer', {
            from: senderPeer.id,
            answer: data.answer,
          });
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
        if (targetPeer && senderPeer && data.candidate) {
          // Send to ALL sockets of target peer
          emitToPeer(io, targetPeer, 'rtc-ice', {
            from: senderPeer.id,
            candidate: data.candidate,
          });
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
            // Get viewers BEFORE removing peer (so we know who to notify)
            const viewers = getViewersOf(peer);
            
            // Remove from room if in private mode
            if (peer.mode === 'private' && peer.roomCode && rooms.has(peer.roomCode)) {
              rooms.get(peer.roomCode)!.peerIds.delete(peer.id);
              if (rooms.get(peer.roomCode)!.peerIds.size === 0) {
                rooms.delete(peer.roomCode);
              }
            }
            
            peers.delete(peer.id);
            console.log(`Peer left: ${peer.name} (${peer.id})`);
            
            // Delta update - notify only peers who could see this peer
            notifyPeerLeft(io, peer.id, viewers);
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
