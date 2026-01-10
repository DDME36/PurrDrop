'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Peer, assignCritter, getDeviceName, generateCuteName } from '@/lib/critters';

interface FileOffer {
  from: Peer;
  file: { name: string; size: number; type: string };
  fileId: string;
}

interface TransferProgress {
  peerId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'sending' | 'receiving' | 'complete' | 'error';
}

interface TransferResult {
  success: boolean;
  fileName: string;
  peerName: string;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function usePeerConnection() {
  const [connected, setConnected] = useState(false);
  const [myPeer, setMyPeer] = useState<Peer | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [fileOffer, setFileOffer] = useState<FileOffer | null>(null);
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingFilesRef = useRef<Map<string, { file: File; peer: Peer }>>(new Map());
  const receivingFilesRef = useRef<Map<string, { chunks: ArrayBuffer[]; info: { name: string; size: number; type: string } }>>(new Map());
  const myPeerRef = useRef<Peer | null>(null);
  const peersRef = useRef<Peer[]>([]);

  // Keep refs in sync
  useEffect(() => { myPeerRef.current = myPeer; }, [myPeer]);
  useEffect(() => { peersRef.current = peers; }, [peers]);

  // Download blob - with iOS Safari support
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    
    // Check if iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // iOS Safari: open in new tab, user can then save
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        // Popup blocked, try direct link
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } else {
      // Other browsers: direct download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, []);

  // Setup data channel handlers
  const setupDataChannel = useCallback((channel: RTCDataChannel, peerId: string) => {
    channel.binaryType = 'arraybuffer';
    
    channel.onopen = () => {
      console.log(`✅ DataChannel OPEN with ${peerId}`);
      dataChannelsRef.current.set(peerId, channel);
    };

    channel.onclose = () => {
      console.log(`❌ DataChannel CLOSED with ${peerId}`);
      dataChannelsRef.current.delete(peerId);
    };

    channel.onerror = (e) => {
      console.error(`DataChannel error:`, e);
    };

    channel.onmessage = (e) => {
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data);
          console.log('📨 DataChannel message:', msg.type);
          
          if (msg.type === 'file-start') {
            receivingFilesRef.current.set(msg.fileId, {
              chunks: [],
              info: { name: msg.name, size: msg.size, type: msg.mimeType },
            });
            setTransfer({
              peerId,
              fileName: msg.name,
              fileSize: msg.size,
              progress: 0,
              status: 'receiving',
            });
          } else if (msg.type === 'file-end') {
            const receiving = receivingFilesRef.current.get(msg.fileId);
            if (receiving) {
              console.log(`✅ File complete: ${receiving.info.name}`);
              const blob = new Blob(receiving.chunks, { type: receiving.info.type || 'application/octet-stream' });
              downloadBlob(blob, receiving.info.name);
              
              setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
              
              const senderPeer = peersRef.current.find(p => p.id === peerId);
              setTransferResult({
                success: true,
                fileName: receiving.info.name,
                peerName: senderPeer?.name || 'เพื่อน',
              });
              
              receivingFilesRef.current.delete(msg.fileId);
              setTimeout(() => setTransfer(null), 2000);
            }
          }
        } catch (err) {
          console.error('Parse error:', err);
        }
      } else {
        // Binary chunk
        const fileId = Array.from(receivingFilesRef.current.keys())[0];
        if (fileId) {
          const receiving = receivingFilesRef.current.get(fileId);
          if (receiving) {
            receiving.chunks.push(e.data);
            const received = receiving.chunks.reduce((acc, c) => acc + c.byteLength, 0);
            const progress = Math.round((received / receiving.info.size) * 100);
            setTransfer(prev => prev ? { ...prev, progress } : null);
          }
        }
      }
    };

    return channel;
  }, [downloadBlob]);

  // Create peer connection
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    console.log(`🔗 Creating PeerConnection for ${peerId}`);
    
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) {
      existing.close();
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        console.log('🧊 Sending ICE candidate');
        socketRef.current.emit('rtc-ice', { to: peerId, candidate: e.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE state: ${pc.iceConnectionState}`);
    };

    pc.ondatachannel = (e) => {
      console.log(`📥 Received DataChannel from ${peerId}`);
      setupDataChannel(e.channel, peerId);
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, [setupDataChannel]);

  // Send file via WebRTC
  const sendFileViaWebRTC = useCallback(async (peerId: string, file: File, fileId: string, targetPeer: Peer) => {
    console.log(`📤 Starting WebRTC transfer to ${peerId}`);
    
    setTransfer({
      peerId,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'sending',
    });

    try {
      // Create connection and data channel
      const pc = createPeerConnection(peerId);
      const dc = pc.createDataChannel('file-transfer', { ordered: true });
      setupDataChannel(dc, peerId);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (!socketRef.current) {
        throw new Error('Socket not connected');
      }
      
      socketRef.current.emit('rtc-offer', { to: peerId, offer });
      console.log('📤 Sent RTC offer');

      // Wait for data channel to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);
        
        dc.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ DataChannel ready for sending');
          resolve();
        };
        
        if (dc.readyState === 'open') {
          clearTimeout(timeout);
          resolve();
        }
      });

      // Send file info
      console.log('📤 Sending file-start');
      dc.send(JSON.stringify({
        type: 'file-start',
        fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      }));

      // Send file chunks
      const CHUNK_SIZE = 16 * 1024;
      const arrayBuffer = await file.arrayBuffer();
      let sent = 0;

      for (let i = 0; i < arrayBuffer.byteLength; i += CHUNK_SIZE) {
        const chunk = arrayBuffer.slice(i, Math.min(i + CHUNK_SIZE, arrayBuffer.byteLength));
        
        // Wait if buffer is full
        while (dc.bufferedAmount > 1024 * 1024) {
          await new Promise(r => setTimeout(r, 50));
        }
        
        dc.send(chunk);
        sent += chunk.byteLength;
        
        const progress = Math.round((sent / arrayBuffer.byteLength) * 100);
        setTransfer(prev => prev ? { ...prev, progress } : null);
      }

      // Send end marker
      console.log('📤 Sending file-end');
      dc.send(JSON.stringify({ type: 'file-end', fileId }));
      
      setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
      setTransferResult({
        success: true,
        fileName: file.name,
        peerName: targetPeer.name,
      });
      
      setTimeout(() => setTransfer(null), 2000);
      
    } catch (err) {
      console.error('❌ Transfer error:', err);
      setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
      setTimeout(() => setTransfer(null), 3000);
    }
  }, [createPeerConnection, setupDataChannel]);

  // Initialize socket connection
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

    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      setConnected(true);
      socket.emit('join', peer);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setConnected(false);
    });

    socket.on('peers', (peerList: Peer[]) => {
      setPeers(peerList.filter(p => p.id !== sessionId));
    });

    socket.on('peer-joined', (newPeer: Peer) => {
      setPeers(prev => {
        const filtered = prev.filter(p => p.id !== newPeer.id);
        return [...filtered, newPeer];
      });
    });

    socket.on('peer-left', (peerId: string) => {
      setPeers(prev => prev.filter(p => p.id !== peerId));
      peerConnectionsRef.current.get(peerId)?.close();
      peerConnectionsRef.current.delete(peerId);
      dataChannelsRef.current.delete(peerId);
    });

    // File signaling
    socket.on('file-offer', (data: FileOffer) => {
      console.log('📦 File offer received:', data.file?.name);
      setFileOffer(data);
    });

    socket.on('file-accept', ({ from, fileId }: { from: string; fileId: string }) => {
      console.log('✅ File accepted by:', from);
      const pending = pendingFilesRef.current.get(fileId);
      if (pending) {
        sendFileViaWebRTC(from, pending.file, fileId, pending.peer);
        pendingFilesRef.current.delete(fileId);
      }
    });

    socket.on('file-reject', () => {
      console.log('❌ File rejected');
      setTransfer(null);
    });

    // WebRTC signaling
    socket.on('rtc-offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      console.log('📥 RTC offer from:', from);
      try {
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('rtc-answer', { to: from, answer });
        console.log('📤 Sent RTC answer');
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socket.on('rtc-answer', async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      console.log('📥 RTC answer from:', from);
      try {
        const pc = peerConnectionsRef.current.get(from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    });

    socket.on('rtc-ice', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      try {
        const pc = peerConnectionsRef.current.get(from);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding ICE:', err);
      }
    });

    return () => {
      socket.close();
      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();
      dataChannelsRef.current.clear();
    };
  }, [createPeerConnection, sendFileViaWebRTC]);

  const sendFile = useCallback((peer: Peer, file: File) => {
    if (!socketRef.current) {
      console.error('Socket not connected');
      return;
    }
    
    const fileId = uuidv4();
    pendingFilesRef.current.set(fileId, { file, peer });
    
    console.log(`📤 Sending file offer: ${file.name} to ${peer.name}`);
    socketRef.current.emit('file-offer', {
      to: peer.id,
      from: myPeerRef.current,
      file: { name: file.name, size: file.size, type: file.type },
      fileId,
    });
  }, []);

  const acceptFile = useCallback(() => {
    if (!socketRef.current || !fileOffer) return;
    console.log(`✅ Accepting file: ${fileOffer.file.name}`);
    socketRef.current.emit('file-accept', { to: fileOffer.from.id, fileId: fileOffer.fileId });
    setFileOffer(null);
  }, [fileOffer]);

  const rejectFile = useCallback(() => {
    if (!socketRef.current || !fileOffer) return;
    socketRef.current.emit('file-reject', { to: fileOffer.from.id });
    setFileOffer(null);
  }, [fileOffer]);

  const updateName = useCallback((name: string) => {
    if (!socketRef.current || !myPeer) return;
    localStorage.setItem('critters_custom_name', name);
    setMyPeer(prev => prev ? { ...prev, name } : null);
    socketRef.current.emit('update-name', { name });
  }, [myPeer]);

  const updateEmoji = useCallback((emoji: string) => {
    if (!socketRef.current || !myPeer) return;
    localStorage.setItem('critters_custom_emoji', emoji);
    setMyPeer(prev => prev ? { ...prev, critter: { ...prev.critter, emoji } } : null);
    socketRef.current.emit('update-emoji', { emoji });
  }, [myPeer]);

  const clearTransferResult = useCallback(() => {
    setTransferResult(null);
  }, []);

  return {
    connected,
    myPeer,
    peers,
    fileOffer,
    transfer,
    transferResult,
    sendFile,
    acceptFile,
    rejectFile,
    updateName,
    updateEmoji,
    clearTransferResult,
  };
}
