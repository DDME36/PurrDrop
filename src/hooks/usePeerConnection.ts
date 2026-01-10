'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Peer, assignCritter, getDeviceName, generateCuteName } from '@/lib/critters';

interface FileOffer {
  from: Peer;
  file: { name: string; size: number; type: string };
}

interface TransferProgress {
  peerId: string;
  fileName: string;
  progress: number;
  status: 'sending' | 'receiving' | 'complete' | 'error';
}

export function usePeerConnection() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [myPeer, setMyPeer] = useState<Peer | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [fileOffer, setFileOffer] = useState<FileOffer | null>(null);
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingFiles = useRef<Map<string, { file: File; peer: Peer }>>(new Map());
  const receivingFiles = useRef<Map<string, { chunks: ArrayBuffer[]; info: { name: string; size: number; type: string } }>>(new Map());

  // Initialize connection
  useEffect(() => {
    let sessionId = localStorage.getItem('critters_session_id');
    if (!sessionId) {
      sessionId = uuidv4().slice(0, 8);
      localStorage.setItem('critters_session_id', sessionId);
    }

    const customName = localStorage.getItem('critters_custom_name') || generateCuteName();
    const customEmoji = localStorage.getItem('critters_custom_emoji') || '';
    const critter = assignCritter(navigator.userAgent);
    const device = getDeviceName(navigator.userAgent);

    if (customEmoji) critter.emoji = customEmoji;

    const peer: Peer = {
      id: sessionId,
      name: customName,
      device,
      critter,
    };
    setMyPeer(peer);

    // Connect to signaling server
    const newSocket = io({
      query: { sessionId, name: customName, emoji: customEmoji },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('join', peer);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('peers', (peerList: Peer[]) => {
      setPeers(peerList.filter(p => p.id !== sessionId));
    });

    newSocket.on('peer-joined', (peer: Peer) => {
      setPeers(prev => {
        if (prev.find(p => p.id === peer.id)) return prev;
        return [...prev, peer];
      });
    });

    newSocket.on('peer-left', (peerId: string) => {
      setPeers(prev => prev.filter(p => p.id !== peerId));
      // Cleanup WebRTC
      const pc = peerConnections.current.get(peerId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(peerId);
      }
      dataChannels.current.delete(peerId);
    });

    // WebRTC Signaling
    newSocket.on('rtc-offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection(from, newSocket);
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      newSocket.emit('rtc-answer', { to: from, answer });
    });

    newSocket.on('rtc-answer', async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(answer);
      }
    });

    newSocket.on('rtc-ice', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(from);
      if (pc) {
        await pc.addIceCandidate(candidate);
      }
    });

    // File offer via signaling (for UI)
    newSocket.on('file-offer', (data: FileOffer) => {
      setFileOffer(data);
    });

    newSocket.on('file-accept', ({ from, fileId }: { from: string; fileId: string }) => {
      const pending = pendingFiles.current.get(fileId);
      if (pending) {
        sendFileViaWebRTC(from, pending.file, fileId);
      }
    });

    newSocket.on('file-reject', () => {
      setTransfer(null);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
      peerConnections.current.forEach(pc => pc.close());
    };
  }, []);

  const createPeerConnection = useCallback((peerId: string, sock: Socket) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sock.emit('rtc-ice', { to: peerId, candidate: e.candidate });
      }
    };

    pc.ondatachannel = (e) => {
      setupDataChannel(e.channel, peerId);
    };

    peerConnections.current.set(peerId, pc);
    return pc;
  }, []);

  const setupDataChannel = useCallback((channel: RTCDataChannel, peerId: string) => {
    channel.binaryType = 'arraybuffer';
    dataChannels.current.set(peerId, channel);

    channel.onmessage = (e) => {
      if (typeof e.data === 'string') {
        const msg = JSON.parse(e.data);
        if (msg.type === 'file-start') {
          receivingFiles.current.set(msg.fileId, {
            chunks: [],
            info: { name: msg.name, size: msg.size, type: msg.mimeType },
          });
          setTransfer({
            peerId,
            fileName: msg.name,
            progress: 0,
            status: 'receiving',
          });
        } else if (msg.type === 'file-end') {
          const receiving = receivingFiles.current.get(msg.fileId);
          if (receiving) {
            const blob = new Blob(receiving.chunks, { type: receiving.info.type });
            downloadBlob(blob, receiving.info.name);
            receivingFiles.current.delete(msg.fileId);
            setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
            setTimeout(() => setTransfer(null), 2000);
          }
        }
      } else {
        // Binary chunk
        const fileId = Array.from(receivingFiles.current.keys())[0];
        if (fileId) {
          const receiving = receivingFiles.current.get(fileId);
          if (receiving) {
            receiving.chunks.push(e.data);
            const received = receiving.chunks.reduce((acc, c) => acc + c.byteLength, 0);
            const progress = Math.round((received / receiving.info.size) * 100);
            setTransfer(prev => prev ? { ...prev, progress } : null);
          }
        }
      }
    };
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendFileViaWebRTC = async (peerId: string, file: File, fileId: string) => {
    let dc = dataChannels.current.get(peerId);
    
    if (!dc || dc.readyState !== 'open') {
      // Create new connection
      const pc = peerConnections.current.get(peerId) || createPeerConnection(peerId, socket!);
      dc = pc.createDataChannel('file-transfer');
      setupDataChannel(dc, peerId);
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('rtc-offer', { to: peerId, offer });
      
      // Wait for channel to open
      await new Promise<void>((resolve) => {
        dc!.onopen = () => resolve();
        setTimeout(resolve, 5000); // Timeout
      });
    }

    if (dc.readyState !== 'open') {
      setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
      return;
    }

    // Send file info
    dc.send(JSON.stringify({
      type: 'file-start',
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
    }));

    // Send chunks
    const CHUNK_SIZE = 64 * 1024; // 64KB
    const reader = file.stream().getReader();
    let sent = 0;

    setTransfer({
      peerId,
      fileName: file.name,
      progress: 0,
      status: 'sending',
    });

    const sendChunk = async () => {
      const { done, value } = await reader.read();
      if (done) {
        dc!.send(JSON.stringify({ type: 'file-end', fileId }));
        setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
        pendingFiles.current.delete(fileId);
        setTimeout(() => setTransfer(null), 2000);
        return;
      }

      // Split into smaller chunks if needed
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        const chunk = value.slice(i, i + CHUNK_SIZE);
        dc!.send(chunk);
        sent += chunk.length;
        setTransfer(prev => prev ? { ...prev, progress: Math.round((sent / file.size) * 100) } : null);
        
        // Throttle to prevent buffer overflow
        if (dc!.bufferedAmount > 1024 * 1024) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
      
      sendChunk();
    };

    sendChunk();
  };

  const sendFile = useCallback((peer: Peer, file: File) => {
    if (!socket) return;
    
    const fileId = uuidv4();
    pendingFiles.current.set(fileId, { file, peer });
    
    socket.emit('file-offer', {
      to: peer.id,
      from: myPeer,
      file: { name: file.name, size: file.size, type: file.type },
      fileId,
    });
  }, [socket, myPeer]);

  const acceptFile = useCallback(() => {
    if (!socket || !fileOffer) return;
    socket.emit('file-accept', { to: fileOffer.from.id });
    setFileOffer(null);
  }, [socket, fileOffer]);

  const rejectFile = useCallback(() => {
    if (!socket || !fileOffer) return;
    socket.emit('file-reject', { to: fileOffer.from.id });
    setFileOffer(null);
  }, [socket, fileOffer]);

  const updateName = useCallback((name: string) => {
    if (!socket || !myPeer) return;
    localStorage.setItem('critters_custom_name', name);
    setMyPeer(prev => prev ? { ...prev, name } : null);
    socket.emit('update-name', { name });
  }, [socket, myPeer]);

  const updateEmoji = useCallback((emoji: string) => {
    if (!socket || !myPeer) return;
    localStorage.setItem('critters_custom_emoji', emoji);
    setMyPeer(prev => prev ? { ...prev, critter: { ...prev.critter, emoji } } : null);
    socket.emit('update-emoji', { emoji });
  }, [socket, myPeer]);

  return {
    connected,
    myPeer,
    peers,
    fileOffer,
    transfer,
    sendFile,
    acceptFile,
    rejectFile,
    updateName,
    updateEmoji,
  };
}
