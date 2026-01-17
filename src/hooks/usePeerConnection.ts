'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { Peer, assignCritter, getDeviceName, generateCuteName } from '@/lib/critters';
import { createStreamWriter, shouldUseStreaming, StreamWriter, FileTooLargeError } from '@/lib/streamSaver';

interface FileOffer {
  from: Peer;
  file: { name: string; size: number; type: string };
  fileId: string;
}

interface TransferProgress {
  peerId: string;
  peerName: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'sending' | 'receiving' | 'complete' | 'error';
  connectionType?: 'direct' | 'stun' | 'relay';
}

interface TransferResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  peerName: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type DiscoveryMode = 'public' | 'wifi' | 'private';

export interface PeerWithMeta extends Peer {
  sameNetwork?: boolean;
  inRoom?: boolean;
}

// ICE Servers - STUN + Free TURN (OpenRelay by Metered)
// TURN servers help connect users behind strict NAT/firewalls
const ICE_SERVERS: RTCIceServer[] = [
  // Google STUN servers (fast, reliable)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },

  // OpenRelay Free TURN servers (no signup required)
  // These help when direct P2P connection fails
  {
    urls: 'stun:stun.relay.metered.ca:80',
  },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: 'e7b4c5a0d1f2e3b4c5a6',
    credential: 'zXcVbNmLkJhGfDsA',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: 'e7b4c5a0d1f2e3b4c5a6',
    credential: 'zXcVbNmLkJhGfDsA',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: 'e7b4c5a0d1f2e3b4c5a6',
    credential: 'zXcVbNmLkJhGfDsA',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: 'e7b4c5a0d1f2e3b4c5a6',
    credential: 'zXcVbNmLkJhGfDsA',
  },
];

const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // Reduced to 500ms for smoother recovery

export function usePeerConnection() {
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [myPeer, setMyPeer] = useState<Peer | null>(null);
  const [peers, setPeers] = useState<PeerWithMeta[]>([]);
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('public');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomPassword, setRoomPassword] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [fileOffer, setFileOffer] = useState<FileOffer | null>(null);
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingFilesRef = useRef<Map<string, { file: File; peer: Peer }>>(new Map());
  const receivingFilesRef = useRef<Map<string, {
    chunks: ArrayBuffer[];
    info: { name: string; size: number; type: string };
    streamWriter?: StreamWriter;
    useStreaming: boolean;
    received: number;
  }>>(new Map());
  const myPeerRef = useRef<Peer | null>(null);
  const peersRef = useRef<PeerWithMeta[]>([]);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Wake Lock - prevent screen from sleeping during transfer
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('🔒 Wake Lock acquired');
      } catch (err) {
        console.log('Wake Lock not available:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('🔓 Wake Lock released');
    }
  }, []);

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

    channel.onmessage = async (e) => {
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data);
          // Heartbeat handling
          if (msg.type === 'ping') {
            console.log('💓 Ping received');
            channel.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          if (msg.type === 'pong') {
            console.log('💓 Pong received');
            // Check handled in useEffect
            return;
          }

          console.log('📨 DataChannel message:', msg.type);

          if (msg.type === 'file-start') {
            const senderPeer = peersRef.current.find(p => p.id === peerId);
            const useStreaming = shouldUseStreaming(msg.size);

            // For large files, try to use streaming
            let streamWriter: StreamWriter | undefined;
            if (useStreaming) {
              console.log(`📁 Large file (${(msg.size / 1024 / 1024).toFixed(1)}MB) - using streaming`);
              try {
                streamWriter = await createStreamWriter(msg.name, msg.mimeType, msg.size);
              } catch (err) {
                if (err instanceof FileTooLargeError) {
                  console.error('❌ File too large for this browser:', err.message);
                  // Notify user and abort
                  setTransfer({
                    peerId,
                    peerName: senderPeer?.name || 'ไม่ทราบชื่อ',
                    fileName: msg.name,
                    fileSize: msg.size,
                    progress: 0,
                    status: 'error',
                  });
                  setTimeout(() => setTransfer(null), 5000);
                  return;
                }
                console.log('Streaming not available, using memory buffer:', err);
              }
            }

            receivingFilesRef.current.set(msg.fileId, {
              chunks: [],
              info: { name: msg.name, size: msg.size, type: msg.mimeType },
              streamWriter,
              useStreaming: !!streamWriter,
              received: 0,
            });

            // Request wake lock when receiving
            if ('wakeLock' in navigator) {
              navigator.wakeLock.request('screen').then(lock => {
                wakeLockRef.current = lock;
              }).catch(() => { });
            }
            setTransfer({
              peerId,
              peerName: senderPeer?.name || 'ไม่ทราบชื่อ',
              fileName: msg.name,
              fileSize: msg.size,
              progress: 0,
              status: 'receiving',
            });
          } else if (msg.type === 'file-end') {
            const receiving = receivingFilesRef.current.get(msg.fileId);
            if (receiving) {
              console.log(`✅ File complete: ${receiving.info.name}`);

              if (receiving.streamWriter) {
                // Streaming mode - just close the writer
                await receiving.streamWriter.close();
                console.log('📁 Stream closed - file saved');
              } else {
                // Memory mode - create blob and download
                const blob = new Blob(receiving.chunks, { type: receiving.info.type || 'application/octet-stream' });
                downloadBlob(blob, receiving.info.name);
              }

              setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);

              const senderPeer = peersRef.current.find(p => p.id === peerId);
              setTransferResult({
                success: true,
                fileName: receiving.info.name,
                fileSize: receiving.info.size,
                peerName: senderPeer?.name || 'เพื่อน',
              });

              receivingFilesRef.current.delete(msg.fileId);
              // Release wake lock after receive complete
              if (wakeLockRef.current) {
                wakeLockRef.current.release();
                wakeLockRef.current = null;
              }
              // Let TransferProgress component handle the display timing
              setTimeout(() => setTransfer(null), 8000);
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
            receiving.received += e.data.byteLength;

            if (receiving.streamWriter) {
              // Streaming mode - write directly to disk
              await receiving.streamWriter.write(e.data);
            } else {
              // Memory mode - collect chunks
              receiving.chunks.push(e.data);
            }

            const progress = Math.round((receiving.received / receiving.info.size) * 100);
            setTransfer(prev => prev ? { ...prev, progress } : null);
          }
        }
      }
    };

    return channel;
  }, [downloadBlob]);

  // Heartbeat Loop
  useEffect(() => {
    const interval = setInterval(() => {
      dataChannelsRef.current.forEach((channel, peerId) => {
        if (channel.readyState === 'open') {
          // Send Ping
          try {
            channel.send(JSON.stringify({ type: 'ping' }));
          } catch (e) {
            console.error('Error sending heartbeat:', e);
          }
        }
      });
    }, 5000); // Ping every 5s

    return () => clearInterval(interval);
  }, []);

  // Monitor Connection State & Auto-Reconnect
  useEffect(() => {
    const checkConnection = () => {
      peerConnectionsRef.current.forEach((pc, peerId) => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          console.log(`⚠️ Connection lost with ${peerId}, attempting reconnect...`);
          setConnectionStatus('reconnecting');

          // Close and retry
          pc.close();
          peerConnectionsRef.current.delete(peerId);
          dataChannelsRef.current.delete(peerId);

          // Find peer info to reconnect
          const targetPeer = peersRef.current.find(p => p.id === peerId);
          // We can't initiate connection comfortably here without user action usually
          // But we can clean up to be ready for new offer
        }
      });
    };

    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    console.log(`🔗 Creating PeerConnection for ${peerId}`);

    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) {
      existing.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10, // Pre-fetch candidates for faster connection
    });

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        console.log('🧊 Sending ICE candidate');
        socketRef.current.emit('rtc-ice', { to: peerId, candidate: e.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE state: ${pc.iceConnectionState}`);

      // Log connection type when connected and update transfer state
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        pc.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              const localCandidate = stats.get(report.localCandidateId);
              const remoteCandidate = stats.get(report.remoteCandidateId);

              const localType = localCandidate?.candidateType || 'unknown';
              const remoteType = remoteCandidate?.candidateType || 'unknown';

              let connectionType: 'direct' | 'stun' | 'relay' = 'direct';

              if (localType === 'relay' || remoteType === 'relay') {
                console.log('🔄 Connection via TURN relay (fallback)');
                connectionType = 'relay';
              } else if (localType === 'srflx' || remoteType === 'srflx') {
                console.log('✅ Connection via STUN (server reflexive)');
                connectionType = 'stun';
              } else {
                console.log('⚡ Direct P2P connection (host)');
                connectionType = 'direct';
              }
              console.log(`📡 Local: ${localType}, Remote: ${remoteType}`);

              // Update transfer state with connection type
              setTransfer(prev => prev ? { ...prev, connectionType } : null);
            }
          });
        });
      }
    };

    pc.ondatachannel = (e) => {
      console.log(`📥 Received DataChannel from ${peerId}`);
      setupDataChannel(e.channel, peerId);
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, [setupDataChannel]);

  // Send file via WebRTC with retry logic
  const sendFileViaWebRTC = useCallback(async (peerId: string, file: File, fileId: string, targetPeer: Peer, retryCount = 0) => {
    console.log(`📤 Starting WebRTC transfer to ${peerId} (attempt ${retryCount + 1})`);

    // Request wake lock to prevent screen sleep
    await requestWakeLock();

    setTransfer({
      peerId,
      peerName: targetPeer.name,
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

      // Wait for data channel to open with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);

        dc.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ DataChannel ready for sending');
          resolve();
        };

        dc.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('DataChannel error'));
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
      const CHUNK_SIZE = 64 * 1024; // Optimized: 64KB chunks
      const arrayBuffer = await file.arrayBuffer();
      let sent = 0;

      // Set backpressure threshold - browser fires 'bufferedamountlow' when buffer drops below this
      dc.bufferedAmountLowThreshold = 65536; // 64KB

      for (let i = 0; i < arrayBuffer.byteLength; i += CHUNK_SIZE) {
        const chunk = arrayBuffer.slice(i, Math.min(i + CHUNK_SIZE, arrayBuffer.byteLength));

        // Intelligent Backpressure: Wait ONLY if buffer is full
        if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
          await new Promise<void>((resolve, reject) => {
            const onLow = () => {
              cleanup();
              resolve();
            };

            const onError = () => {
              cleanup();
              reject(new Error('DataChannel error during transfer'));
            };

            const onClose = () => {
              cleanup();
              reject(new Error('DataChannel closed during transfer'));
            };

            const cleanup = () => {
              dc.removeEventListener('bufferedamountlow', onLow);
              dc.removeEventListener('error', onError);
              dc.removeEventListener('close', onClose);
            };

            dc.addEventListener('bufferedamountlow', onLow);
            dc.addEventListener('error', onError);
            dc.addEventListener('close', onClose);

            // Failsafe: if state changed while setting up
            if (dc.readyState !== 'open') {
              onClose();
            }
          });
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
        fileSize: file.size,
        peerName: targetPeer.name,
      });

      // Release wake lock after transfer complete
      releaseWakeLock();

      // Let TransferProgress component handle the display timing
      setTimeout(() => setTransfer(null), 8000);

    } catch (err) {
      console.error('❌ Transfer error:', err);

      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying transfer (${retryCount + 1}/${MAX_RETRIES})...`);
        setTransfer(prev => prev ? { ...prev, status: 'sending', progress: 0 } : null);

        // Clean up failed connection
        peerConnectionsRef.current.get(peerId)?.close();
        peerConnectionsRef.current.delete(peerId);
        dataChannelsRef.current.delete(peerId);

        // Wait before retry
        await new Promise(r => setTimeout(r, RETRY_DELAY));

        // Retry
        return sendFileViaWebRTC(peerId, file, fileId, targetPeer, retryCount + 1);
      }

      // Release wake lock on error
      releaseWakeLock();

      setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
      setTransferResult({
        success: false,
        fileName: file.name,
        fileSize: file.size,
        peerName: targetPeer.name,
      });
      setTimeout(() => setTransfer(null), 5000);
    }
  }, [createPeerConnection, setupDataChannel, requestWakeLock, releaseWakeLock]);

  // Initialize socket connection
  useEffect(() => {
    // Don't connect if in In-App Browser
    if (typeof window !== 'undefined' && sessionStorage.getItem('purrdrop_inapp') === 'true') {
      console.log('🚫 In-App Browser detected, not connecting');
      setConnectionStatus('disconnected');
      return;
    }

    let sessionId = localStorage.getItem('critters_session_id');
    if (!sessionId) {
      sessionId = uuidv4().slice(0, 8);
      localStorage.setItem('critters_session_id', sessionId);
    }

    // Priority: LocalStorage > Generated
    let customName = localStorage.getItem('critters_custom_name');
    if (!customName) {
      customName = generateCuteName();
      localStorage.setItem('critters_custom_name', customName);
    }

    const customEmoji = localStorage.getItem('critters_custom_emoji');
    const critter = assignCritter(navigator.userAgent);
    const device = getDeviceName(navigator.userAgent);

    // ใช้ emoji ที่ user เลือกไว้ (ถ้ามี)
    if (customEmoji) {
      critter.emoji = customEmoji;
    }

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
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      setConnected(true);
      setConnectionStatus('connected');
      socket.emit('join', peer);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setConnected(false);
      setConnectionStatus('disconnected');
    });

    socket.on('reconnecting', () => {
      console.log('🔄 Socket reconnecting...');
      setConnectionStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      console.log('✅ Socket reconnected');
      setConnected(true);
      setConnectionStatus('connected');
      socket.emit('join', peer);
    });

    socket.on('reconnect_failed', () => {
      console.log('❌ Socket reconnection failed');
      setConnectionStatus('disconnected');
    });

    socket.on('peers', (peerList: PeerWithMeta[]) => {
      const filtered = peerList.filter(p => p.id !== sessionId);
      // เก็บ IDs ไว้ใน ref ด้วย เพื่อให้ peer-joined เช็คได้
      const ids = new Set(filtered.map(p => p.id));
      peersRef.current = filtered;
      setPeers(filtered);
    });

    socket.on('room-info', ({ roomCode: code }: { roomCode: string }) => {
      console.log('🏠 Room code:', code);
      setRoomCode(code);
    });

    socket.on('mode-info', ({ mode, roomCode: code, roomPassword: pwd, networkName: netName }: { mode: DiscoveryMode; roomCode: string | null; roomPassword: string | null; networkName?: string }) => {
      console.log('🔄 Mode:', mode, 'Room:', code, 'Network:', netName);
      setDiscoveryMode(mode);
      setRoomCode(code);
      setRoomPassword(pwd);
      if (netName) setNetworkName(netName);
      setRoomError(null);
    });

    socket.on('room-error', ({ error, message }: { error: string; message: string }) => {
      console.log('❌ Room error:', error, message);
      setRoomError(message);
      // Clear error after 5 seconds
      setTimeout(() => setRoomError(null), 5000);
    });

    socket.on('peer-joined', (newPeer: PeerWithMeta) => {
      // ใช้ ref เช็คแทน state เพื่อความแม่นยำ
      if (peersRef.current.some(p => p.id === newPeer.id)) {
        return; // มีอยู่แล้ว ไม่ต้อง add
      }
      setPeers(prev => {
        if (prev.some(p => p.id === newPeer.id)) {
          return prev;
        }
        return [...prev, newPeer];
      });
    });

    socket.on('peer-left', (peerId: string) => {
      setPeers(prev => prev.filter(p => p.id !== peerId));
      peerConnectionsRef.current.get(peerId)?.close();
      peerConnectionsRef.current.delete(peerId);
      dataChannelsRef.current.delete(peerId);
    });

    socket.on('peer-updated', (updatedPeer: PeerWithMeta) => {
      setPeers(prev => prev.map(p => p.id === updatedPeer.id ? updatedPeer : p));
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

    // Show pending state with animation while waiting for accept
    setTransfer({
      peerId: peer.id,
      peerName: peer.name,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'pending',
    });

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

  const cancelTransfer = useCallback(() => {
    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, peerId) => {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    });
    dataChannelsRef.current.clear();
    pendingFilesRef.current.clear();

    // Abort any streaming writers
    receivingFilesRef.current.forEach(receiving => {
      if (receiving.streamWriter) {
        receiving.streamWriter.abort();
      }
    });
    receivingFilesRef.current.clear();

    releaseWakeLock();
    setTransfer(null);
    setFileOffer(null);
  }, [releaseWakeLock]);

  const joinRoom = useCallback((code: string) => {
    if (!socketRef.current) return;
    console.log('🚪 Joining room:', code);
    socketRef.current.emit('set-mode', { mode: 'private', roomCode: code });
  }, []);

  const createRoom = useCallback(() => {
    if (!socketRef.current) return;
    console.log('✨ Creating new room');
    socketRef.current.emit('set-mode', { mode: 'private' });
  }, []);

  const setMode = useCallback((mode: DiscoveryMode, code?: string, password?: string) => {
    if (!socketRef.current) return;
    console.log('🔄 Setting mode:', mode, code, password ? '(with password)' : '');
    socketRef.current.emit('set-mode', { mode, roomCode: code, password });
  }, []);

  return {
    connected,
    connectionStatus,
    myPeer,
    peers,
    discoveryMode,
    roomCode,
    roomPassword,
    networkName,
    roomError,
    fileOffer,
    transfer,
    transferResult,
    sendFile,
    acceptFile,
    rejectFile,
    updateName,
    updateEmoji,
    clearTransferResult,
    cancelTransfer,
    joinRoom,
    createRoom,
    setMode,
  };
}
