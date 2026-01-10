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
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

export function usePeerConnection() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [myPeer, setMyPeer] = useState<Peer | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [fileOffer, setFileOffer] = useState<FileOffer | null>(null);
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingFiles = useRef<Map<string, { file: File; peer: Peer }>>(new Map());
  const receivingFiles = useRef<Map<string, { chunks: ArrayBuffer[]; info: { name: string; size: number; type: string }; fromPeer?: Peer }>>(new Map());
  const myPeerRef = useRef<Peer | null>(null);

  // Keep refs in sync
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    myPeerRef.current = myPeer;
  }, [myPeer]);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const setupDataChannel = useCallback((channel: RTCDataChannel, peerId: string) => {
    channel.binaryType = 'arraybuffer';
    dataChannels.current.set(peerId, channel);

    channel.onopen = () => {
      console.log(`DataChannel opened with ${peerId}`);
    };

    channel.onclose = () => {
      console.log(`DataChannel closed with ${peerId}`);
      dataChannels.current.delete(peerId);
    };

    channel.onerror = (e) => {
      console.error(`DataChannel error with ${peerId}:`, e);
    };

    channel.onmessage = (e) => {
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data);
          console.log('Received message:', msg.type);
          
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
              console.log(`File complete: ${receiving.info.name}, chunks: ${receiving.chunks.length}`);
              const blob = new Blob(receiving.chunks, { type: receiving.info.type || 'application/octet-stream' });
              downloadBlob(blob, receiving.info.name);
              
              setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
              setTransferResult({
                success: true,
                fileName: receiving.info.name,
                peerName: peers.find(p => p.id === peerId)?.name || 'Unknown',
              });
              
              receivingFiles.current.delete(msg.fileId);
              setTimeout(() => setTransfer(null), 2000);
            }
          }
        } catch (err) {
          console.error('Error parsing message:', err);
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

    return channel;
  }, [downloadBlob, peers]);

  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    // Close existing connection if any
    const existing = peerConnections.current.get(peerId);
    if (existing) {
      existing.close();
      peerConnections.current.delete(peerId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('rtc-ice', { to: peerId, candidate: e.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state with ${peerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        pc.close();
        peerConnections.current.delete(peerId);
        dataChannels.current.delete(peerId);
      }
    };

    pc.ondatachannel = (e) => {
      console.log(`Received data channel from ${peerId}`);
      setupDataChannel(e.channel, peerId);
    };

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [setupDataChannel]);

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
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      newSocket.emit('join', peer);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('peers', (peerList: Peer[]) => {
      setPeers(peerList.filter(p => p.id !== sessionId));
    });

    newSocket.on('peer-joined', (newPeer: Peer) => {
      setPeers(prev => {
        const filtered = prev.filter(p => p.id !== newPeer.id);
        return [...filtered, newPeer];
      });
    });

    newSocket.on('peer-left', (peerId: string) => {
      setPeers(prev => prev.filter(p => p.id !== peerId));
      const pc = peerConnections.current.get(peerId);
      if (pc) {
        pc.close();
        peerConnections.current.delete(peerId);
      }
      dataChannels.current.delete(peerId);
    });

    // WebRTC Signaling
    newSocket.on('rtc-offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      console.log(`Received offer from ${from}`);
      try {
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        newSocket.emit('rtc-answer', { to: from, answer });
        console.log(`Sent answer to ${from}`);
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    newSocket.on('rtc-answer', async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      console.log(`Received answer from ${from}`);
      try {
        const pc = peerConnections.current.get(from);
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    });

    newSocket.on('rtc-ice', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      try {
        const pc = peerConnections.current.get(from);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    // File offer via signaling
    newSocket.on('file-offer', (data: FileOffer) => {
      console.log('Received file offer:', data);
      setFileOffer(data);
    });

    newSocket.on('file-accept', async ({ from, fileId }: { from: string; fileId: string }) => {
      console.log(`File accepted by ${from}, fileId: ${fileId}`);
      const pending = pendingFiles.current.get(fileId);
      if (pending) {
        await sendFileViaWebRTC(from, pending.file, fileId, pending.peer);
      }
    });

    newSocket.on('file-reject', () => {
      setTransfer(null);
      pendingFiles.current.clear();
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      dataChannels.current.clear();
    };
  }, [createPeerConnection]);

  const sendFileViaWebRTC = async (peerId: string, file: File, fileId: string, targetPeer: Peer) => {
    console.log(`Starting file transfer to ${peerId}`);
    
    setTransfer({
      peerId,
      fileName: file.name,
      progress: 0,
      status: 'sending',
    });

    try {
      let dc = dataChannels.current.get(peerId);
      
      if (!dc || dc.readyState !== 'open') {
        console.log('Creating new WebRTC connection...');
        const pc = createPeerConnection(peerId);
        dc = pc.createDataChannel('file-transfer', { ordered: true });
        setupDataChannel(dc, peerId);
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('rtc-offer', { to: peerId, offer });
        
        // Wait for channel to open with better handling
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 15000);
          
          dc!.onopen = () => {
            clearTimeout(timeout);
            console.log('DataChannel opened, ready to send');
            resolve();
          };
          
          dc!.onerror = (e) => {
            clearTimeout(timeout);
            reject(e);
          };
        });
      }

      if (!dc || dc.readyState !== 'open') {
        throw new Error('DataChannel not open');
      }

      console.log('Sending file info...');
      // Send file info
      dc.send(JSON.stringify({
        type: 'file-start',
        fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      }));

      // Send file in chunks
      const CHUNK_SIZE = 16 * 1024; // 16KB chunks for better reliability
      const arrayBuffer = await file.arrayBuffer();
      const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
      let sentChunks = 0;

      console.log(`Sending ${totalChunks} chunks...`);

      for (let i = 0; i < arrayBuffer.byteLength; i += CHUNK_SIZE) {
        const chunk = arrayBuffer.slice(i, i + CHUNK_SIZE);
        
        // Wait if buffer is getting full
        while (dc.bufferedAmount > 1024 * 1024) {
          await new Promise(r => setTimeout(r, 50));
        }
        
        dc.send(chunk);
        sentChunks++;
        
        const progress = Math.round((sentChunks / totalChunks) * 100);
        setTransfer(prev => prev ? { ...prev, progress } : null);
      }

      console.log('Sending file-end...');
      dc.send(JSON.stringify({ type: 'file-end', fileId }));
      
      setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
      setTransferResult({
        success: true,
        fileName: file.name,
        peerName: targetPeer.name,
      });
      
      pendingFiles.current.delete(fileId);
      setTimeout(() => setTransfer(null), 2000);
      
    } catch (err) {
      console.error('File transfer error:', err);
      setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
      setTimeout(() => setTransfer(null), 3000);
    }
  };

  const sendFile = useCallback((peer: Peer, file: File) => {
    if (!socket) return;
    
    const fileId = uuidv4();
    pendingFiles.current.set(fileId, { file, peer });
    
    console.log(`Sending file offer: ${file.name} to ${peer.name}`);
    socket.emit('file-offer', {
      to: peer.id,
      from: myPeerRef.current,
      file: { name: file.name, size: file.size, type: file.type },
      fileId,
    });
  }, [socket]);

  const acceptFile = useCallback(() => {
    if (!socket || !fileOffer) return;
    console.log(`Accepting file: ${fileOffer.fileId}`);
    socket.emit('file-accept', { to: fileOffer.from.id, fileId: fileOffer.fileId });
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
