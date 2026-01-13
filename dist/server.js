"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
// All connected peers
const peers = new Map();
// Room code -> { peerIds, password }
const rooms = new Map();
// Generate 5-digit room code
function generateRoomCode() {
    let code;
    do {
        code = Math.floor(10000 + Math.random() * 90000).toString();
    } while (rooms.has(code) && rooms.get(code).peerIds.size > 0);
    return code;
}
// Get client's real IP
function getClientIP(socket) {
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
function getWiFiGroupId(ip) {
    // Use full IP as group identifier
    // Devices on same WiFi network will have same Public IP
    return ip;
}
// Get peer by socket ID
function getPeerBySocketId(socketId) {
    for (const peer of peers.values()) {
        if (peer.sockets.has(socketId)) {
            return peer;
        }
    }
    return undefined;
}
// Send to all sockets of a peer
function emitToPeer(io, peer, event, data) {
    peer.sockets.forEach(socketId => {
        io.to(socketId).emit(event, data);
    });
}
// Get peers visible to a specific peer based on their mode
function getVisiblePeers(peer) {
    const visible = [];
    const peerWiFiGroup = getWiFiGroupId(peer.publicIP);
    for (const otherPeer of peers.values()) {
        if (otherPeer.id === peer.id)
            continue;
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
function broadcastPeers(io) {
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
    const httpServer = (0, http_1.createServer)((req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url, true);
        handle(req, res, parsedUrl);
    });
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        transports: ['websocket', 'polling'],
    });
    io.on('connection', (socket) => {
        const clientIP = getClientIP(socket);
        console.log('Client connected:', socket.id, 'IP:', clientIP);
        socket.on('join', (peerData) => {
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
                        roomPassword: existingPeer.roomPassword,
                    });
                }
                else {
                    // New user - default to public mode
                    const peer = {
                        ...peerData,
                        sockets: new Set([socket.id]),
                        publicIP: clientIP,
                        mode: 'public',
                        roomCode: null,
                        roomPassword: null,
                    };
                    peers.set(peerData.id, peer);
                    console.log(`Peer joined: ${peer.name} (${peer.id}) IP: ${clientIP} Mode: public`);
                    // Send mode info to client
                    emitToPeer(io, peer, 'mode-info', {
                        mode: 'public',
                        roomCode: null,
                        roomPassword: null,
                    });
                }
                broadcastPeers(io);
            }
            catch (err) {
                console.error('Error in join handler:', err);
            }
        });
        // Change discovery mode
        socket.on('set-mode', ({ mode, roomCode, password }) => {
            try {
                const peer = getPeerBySocketId(socket.id);
                if (!peer)
                    return;
                // Validate mode
                if (!['public', 'wifi', 'private'].includes(mode)) {
                    console.error('Invalid mode:', mode);
                    return;
                }
                const oldMode = peer.mode;
                const oldRoom = peer.roomCode;
                // Leave old room if was in private mode
                if (oldMode === 'private' && oldRoom && rooms.has(oldRoom)) {
                    rooms.get(oldRoom).peerIds.delete(peer.id);
                    if (rooms.get(oldRoom).peerIds.size === 0) {
                        rooms.delete(oldRoom);
                    }
                }
                // Set new mode
                peer.mode = mode;
                if (mode === 'private') {
                    // Joining existing room
                    if (roomCode && /^\d{5}$/.test(roomCode)) {
                        const existingRoom = rooms.get(roomCode);
                        // Check password if room exists and has password
                        if (existingRoom && existingRoom.password) {
                            if (password !== existingRoom.password) {
                                // Wrong password
                                console.log(`${peer.name} failed to join room ${roomCode} - wrong password`);
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
                                });
                                broadcastPeers(io);
                                return;
                            }
                        }
                        peer.roomCode = roomCode;
                        peer.roomPassword = existingRoom?.password || null;
                        if (!existingRoom) {
                            // Create room with password if provided
                            rooms.set(roomCode, {
                                peerIds: new Set([peer.id]),
                                password: password || null
                            });
                            peer.roomPassword = password || null;
                        }
                        else {
                            existingRoom.peerIds.add(peer.id);
                        }
                        console.log(`${peer.name} joined room ${roomCode}${peer.roomPassword ? ' (password protected)' : ''}`);
                    }
                    else {
                        // Create new room
                        const code = generateRoomCode();
                        peer.roomCode = code;
                        peer.roomPassword = password || null;
                        rooms.set(code, {
                            peerIds: new Set([peer.id]),
                            password: password || null
                        });
                        console.log(`${peer.name} created room ${code}${password ? ' (password protected)' : ''}`);
                    }
                }
                else {
                    peer.roomCode = null;
                    peer.roomPassword = null;
                    console.log(`${peer.name} switched to ${mode} mode`);
                }
                // Send confirmation
                emitToPeer(io, peer, 'mode-info', {
                    mode: peer.mode,
                    roomCode: peer.roomCode,
                    roomPassword: peer.roomPassword,
                });
                broadcastPeers(io);
            }
            catch (err) {
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
            }
            catch (err) {
                console.error('Error in file-offer handler:', err);
            }
        });
        socket.on('file-accept', (data) => {
            try {
                if (!data || !data.to)
                    return;
                const targetPeer = peers.get(data.to);
                const senderPeer = getPeerBySocketId(socket.id);
                if (targetPeer && senderPeer) {
                    emitToPeer(io, targetPeer, 'file-accept', {
                        from: senderPeer.id,
                        fileId: data.fileId,
                    });
                }
            }
            catch (err) {
                console.error('Error in file-accept handler:', err);
            }
        });
        socket.on('file-reject', (data) => {
            try {
                if (!data || !data.to)
                    return;
                const targetPeer = peers.get(data.to);
                if (targetPeer) {
                    emitToPeer(io, targetPeer, 'file-reject', {});
                }
            }
            catch (err) {
                console.error('Error in file-reject handler:', err);
            }
        });
        // WebRTC Signaling - broadcast to all sockets of peer
        socket.on('rtc-offer', (data) => {
            try {
                if (!data || !data.to || !data.offer)
                    return;
                const targetPeer = peers.get(data.to);
                const senderPeer = getPeerBySocketId(socket.id);
                if (targetPeer && senderPeer) {
                    // Send to ALL sockets of target peer (handles multiple tabs)
                    emitToPeer(io, targetPeer, 'rtc-offer', {
                        from: senderPeer.id,
                        offer: data.offer,
                    });
                }
            }
            catch (err) {
                console.error('Error in rtc-offer handler:', err);
            }
        });
        socket.on('rtc-answer', (data) => {
            try {
                if (!data || !data.to || !data.answer)
                    return;
                const targetPeer = peers.get(data.to);
                const senderPeer = getPeerBySocketId(socket.id);
                if (targetPeer && senderPeer) {
                    // Send to ALL sockets of target peer
                    emitToPeer(io, targetPeer, 'rtc-answer', {
                        from: senderPeer.id,
                        answer: data.answer,
                    });
                }
            }
            catch (err) {
                console.error('Error in rtc-answer handler:', err);
            }
        });
        socket.on('rtc-ice', (data) => {
            try {
                if (!data || !data.to)
                    return;
                const targetPeer = peers.get(data.to);
                const senderPeer = getPeerBySocketId(socket.id);
                if (targetPeer && senderPeer && data.candidate) {
                    // Send to ALL sockets of target peer
                    emitToPeer(io, targetPeer, 'rtc-ice', {
                        from: senderPeer.id,
                        candidate: data.candidate,
                    });
                }
            }
            catch (err) {
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
                            rooms.get(peer.roomCode).peerIds.delete(peer.id);
                            if (rooms.get(peer.roomCode).peerIds.size === 0) {
                                rooms.delete(peer.roomCode);
                            }
                        }
                        peers.delete(peer.id);
                        console.log(`Peer left: ${peer.name} (${peer.id})`);
                        broadcastPeers(io);
                    }
                }
            }
            catch (err) {
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
function getLocalIP() {
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
