'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { AdaptiveChunker } from '@/lib/adaptiveChunker';
import { Peer, assignCritter, getDeviceName, generateCuteName } from '@/lib/critters';
import { createStreamWriter, shouldUseStreaming, StreamWriter } from '@/lib/streamSaver';
import { detectImageMimeType, validateFile, downloadBlob, requestWakeLock, releaseWakeLock } from '@/lib/webrtc';
import { detectDevice, shouldUseRelay } from '@/lib/deviceDetection';
import { handleError, logError } from '@/lib/errorHandler';

const MAX_RETRIES = 2; // เพิ่มจาก 1 → 2 เพื่อให้ P2P มีโอกาสมากขึ้น
const RETRY_DELAY = 500; // เพิ่มจาก 300 → 500ms
const CONNECTION_TIMEOUT = 15000; // เพิ่มจาก 8000 → 15 วินาที - ให้เวลา ICE มากขึ้น

// Debug logging helper
const debugLog = (message: string, ...args: any[]) => {
  console.log(`[PurrDrop Debug] ${message}`, ...args);
};

interface FileOffer {
  from: Peer;
  file: { name: string; size: number; type: string };
  fileId: string;
}

interface TextMessage {
  from: Peer;
  text: string;
  timestamp: number;
}

interface TransferProgress {
  peerId: string;
  peerName: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'connecting' | 'sending' | 'receiving' | 'complete' | 'saving' | 'error';
  connectionType?: 'direct' | 'stun' | 'relay';
}

interface TransferResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  peerName: string;
  direction: 'sent' | 'received';
  type?: 'file' | 'text';
  textContent?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type DiscoveryMode = 'public' | 'wifi' | 'private';

export interface PeerWithMeta extends Peer {
  sameNetwork?: boolean;
  inRoom?: boolean;
}

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
  const [textMessage, setTextMessage] = useState<TextMessage | null>(null);
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null);

  // Refs for tracking reconnection state across renders
  const discoveryModeRef = useRef<DiscoveryMode>('public');
  const roomCodeRef = useRef<string | null>(null);
  const roomPasswordRef = useRef<string | null>(null);

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
    senderId?: string;
  }>>(new Map());
  const receivingTextsRef = useRef<Map<string, {
    chunks: string[];
    totalChunks: number;
    totalLength: number;
    received: number;
  }>>(new Map());
  const myPeerRef = useRef<Peer | null>(null);
  const peersRef = useRef<PeerWithMeta[]>([]);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);
  // Queue ICE candidates that arrive before remoteDescription is set
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Stable refs for callbacks — prevents useEffect from re-running when callbacks change
  const sendFileViaRelayRef = useRef<(peerId: string, file: File, fileId: string, targetPeer: Peer) => Promise<void>>(async () => {});
  const sendFileViaWebRTCRef = useRef<(peerId: string, file: File, fileId: string, targetPeer: Peer, retryCount?: number) => Promise<void>>(async () => {});

  // Wake Lock
  const requestWakeLockFn = useCallback(async () => {
    await requestWakeLock();
  }, []);

  const releaseWakeLockFn = useCallback(() => {
    releaseWakeLock();
  }, []);

  // Keep refs in sync
  useEffect(() => { myPeerRef.current = myPeer; }, [myPeer]);
  useEffect(() => { peersRef.current = peers; }, [peers]);

  // Download blob - with iOS Safari support + Share API
  const downloadBlob = useCallback(async (blob: Blob, filename: string) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      // Try Share API first (best UX for iOS)
      if (navigator.share && navigator.canShare) {
        try {
          const file = new File([blob], filename, { type: blob.type });
          
          if (await navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'PurrDrop',
              text: `ไฟล์: ${filename}`,
            });
            console.log('✅ Shared via Share API');
            return;
          }
        } catch (err) {
          console.log('Share API failed or cancelled:', err);
        }
      }
      
      // Fallback: Open in new tab
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      
      if (!newWindow) {
        // Popup blocked - show instructions
        console.warn('⚠️ Popup blocked - user needs to allow popups');
        // TODO: Show IOSDownloadModal here
        
        // Try direct link as last resort
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } else {
      // Other browsers: direct download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
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
      // DataChannel errors are often empty objects - this is normal WebRTC behavior
      // The actual error details are usually in the RTCPeerConnection state
      const peer = peersRef.current.find(p => p.id === peerId);
      console.warn(`⚠️ DataChannel error with ${peer?.name || peerId}`, e);
      
      // Don't show error to user unless it's during an active transfer
      if (transfer && transfer.peerId === peerId && transfer.status !== 'complete') {
        setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
        setTimeout(() => setTransfer(null), 3000);
      }
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
                // Streaming not available — will fall back to memory buffer (no size limit)
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
                // Streaming mode - file saved automatically
                await receiving.streamWriter.close();
                console.log('📁 Stream closed - file saved');
                setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
              } else {
                // Memory mode - waiting for user to save
                setTransfer(prev => prev ? { ...prev, progress: 100, status: 'saving' } : null);
                const blob = new Blob(receiving.chunks, { type: receiving.info.type || 'application/octet-stream' });
                downloadBlob(blob, receiving.info.name);
                // Set complete after download triggered
                setTimeout(() => {
                  setTransfer(prev => prev ? { ...prev, status: 'complete' } : null);
                }, 500);
              }

              const senderPeer = peersRef.current.find(p => p.id === peerId);
              setTransferResult({
                success: true,
                fileName: receiving.info.name,
                fileSize: receiving.info.size,
                peerName: senderPeer?.name || 'เพื่อน',
                direction: 'received',
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
          } else if (msg.type === 'text-message') {
            const senderPeer = peersRef.current.find(p => p.id === peerId);
            if (senderPeer) {
              setTextMessage({
                from: senderPeer,
                text: msg.payload,
                timestamp: Date.now()
              });
              
              // Show notification for received text
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`ข้อความจาก ${senderPeer.name}`, {
                  body: msg.payload.length > 100 ? msg.payload.substring(0, 100) + '...' : msg.payload,
                  icon: '/icon-192.png',
                  tag: 'text-message',
                });
              }
            }
          } else if (msg.type === 'text-start') {
            // Start receiving chunked text
            receivingTextsRef.current.set(msg.textId, {
              chunks: new Array(msg.totalChunks),
              totalChunks: msg.totalChunks,
              totalLength: msg.totalLength,
              received: 0
            });
            console.log(`📥 Receiving long text: ${msg.totalChunks} chunks`);
          } else if (msg.type === 'text-chunk') {
            const receivingText = receivingTextsRef.current.get(msg.textId);
            if (receivingText) {
              receivingText.chunks[msg.chunkIndex] = msg.chunk;
              receivingText.received++;
              
              // Check if all chunks received
              if (receivingText.received === receivingText.totalChunks) {
                const fullText = receivingText.chunks.join('');
                const senderPeer = peersRef.current.find(p => p.id === peerId);
                if (senderPeer) {
                  setTextMessage({
                    from: senderPeer,
                    text: fullText,
                    timestamp: Date.now()
                  });
                  
                  // Show notification for received long text
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(`ข้อความจาก ${senderPeer.name}`, {
                      body: fullText.length > 100 ? fullText.substring(0, 100) + '...' : fullText,
                      icon: '/icon-192.png',
                      tag: 'text-message',
                    });
                  }
                }
                receivingTextsRef.current.delete(msg.textId);
                console.log('✅ Long text received completely');
              }
            }
          } else if (msg.type === 'text-end') {
            // Cleanup if needed
            receivingTextsRef.current.delete(msg.textId);
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
              // Streaming mode - write directly to disk via StreamSaver
              // StreamSaver's write is async but we don't necessarily need to await it 
              // here unless we want to implement backpressure on the receiving end.
              receiving.streamWriter.write(e.data).catch(err => console.error('Stream write error:', err));
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
  // Track how long each connection has been in unhealthy state
  const unhealthyTimersRef = useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    const checkConnection = () => {
      peerConnectionsRef.current.forEach((pc, peerId) => {
        const state = pc.iceConnectionState;
        
        if (state === 'disconnected' || state === 'failed') {
          const firstSeen = unhealthyTimersRef.current.get(peerId) || Date.now();
          if (!unhealthyTimersRef.current.has(peerId)) {
            unhealthyTimersRef.current.set(peerId, firstSeen);
            console.log(`⚠️ Connection unhealthy with ${peerId} (${state}), monitoring...`);
          }
          
          const elapsed = Date.now() - firstSeen;
          
          // Only clean up if connection has been dead for >15 seconds
          // This gives ICE restart time to work
          if (elapsed > 15000) {
            console.log(`💀 Connection with ${peerId} dead for ${Math.round(elapsed/1000)}s, cleaning up`);
            try { pc.close(); } catch { /* ignore */ }
            peerConnectionsRef.current.delete(peerId);
            dataChannelsRef.current.delete(peerId);
            pendingIceCandidatesRef.current.delete(peerId);
            unhealthyTimersRef.current.delete(peerId);
          }
        } else {
          // Connection is healthy, clear timer
          unhealthyTimersRef.current.delete(peerId);
        }
      });
    };

    const interval = setInterval(checkConnection, 5000);
    return () => {
      clearInterval(interval);
      unhealthyTimersRef.current.clear();
    };
  }, []);

  // Helper: flush queued ICE candidates after remoteDescription is set
  const flushIceCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queue = pendingIceCandidatesRef.current.get(peerId);
    if (queue && queue.length > 0) {
      console.log(`🧊 Flushing ${queue.length} queued ICE candidates for ${peerId}`);
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('⚠️ Error adding queued ICE candidate:', err);
        }
      }
      pendingIceCandidatesRef.current.delete(peerId);
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    console.log(`🔗 Creating PeerConnection for ${peerId}`);

    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) {
      try { existing.close(); } catch { /* ignore */ }
    }

    // Clear any pending ICE candidates from previous connections
    pendingIceCandidatesRef.current.delete(peerId);

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current.length > 0 ? iceServersRef.current : [
        // Fallback STUN servers if API fails
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        console.log('🧊 Sending ICE candidate:', e.candidate.type);
        socketRef.current.emit('rtc-ice', { to: peerId, candidate: e.candidate });
      } else if (!e.candidate) {
        console.log('🧊 ICE gathering complete');
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`🧊 ICE gathering state: ${pc.iceGatheringState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state: ${pc.iceConnectionState}`);

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
      
      // ICE restart on failure — try to renegotiate before giving up
      if (pc.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed - attempting ICE restart');
        pc.getStats().then(stats => {
          console.log('📊 Connection stats:', Array.from(stats.values()));
        });
        // Trigger ICE restart — browser will gather new candidates
        try {
          pc.restartIce();
          console.log('🔄 ICE restart triggered');
        } catch (err) {
          console.error('❌ ICE restart failed:', err);
        }
      }
    };

    pc.ondatachannel = (e) => {
      console.log(`📥 Received DataChannel from ${peerId}`);
      setupDataChannel(e.channel, peerId);
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, [setupDataChannel]);

  // Fallback: Send file via Socket.IO Relay
  const sendFileViaRelay = useCallback(async (peerId: string, file: File, fileId: string, targetPeer: Peer) => {
    console.log(`📤 Starting Server Relay transfer to ${peerId} (Fallback)`);
    console.log(`📊 File: ${file.name}, Size: ${file.size}, Type: ${file.type}`);
    console.log(`🔌 Socket connected: ${socketRef.current?.connected}`);

    setTransfer({
      peerId,
      peerName: targetPeer.name,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'connecting', // เริ่มต้นด้วย connecting
      connectionType: 'relay',
    });

    try {
      if (!socketRef.current) {
        console.error('❌ Socket not connected!');
        throw new Error('Socket not connected');
      }
      
      if (!socketRef.current.connected) {
        console.error('❌ Socket disconnected!');
        throw new Error('Socket disconnected');
      }

      // 1. Send start marker
      console.log(`📤 Emitting relay-start to ${peerId}...`);
      socketRef.current.emit('relay-start', {
        to: peerId,
        fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      });
      console.log('✅ relay-start emitted');

      // 1.5 Wait for relay-ready ACK from receiver
      console.log('⏳ Waiting for relay-ready ACK from receiver...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socketRef.current?.off('relay-ready', onReady);
          reject(new Error('Relay ACK timeout — ผู้รับไม่ตอบสนอง'));
        }, 15000); // 15 seconds max wait

        const onReady = (data: { from: string, fileId: string }) => {
          if (data.fileId === fileId) {
            clearTimeout(timeout);
            socketRef.current?.off('relay-ready', onReady);
            console.log('✅ relay-ready ACK received, starting chunks...');
            
            // เปลี่ยนสถานะเป็น sending เมื่อเริ่มส่งจริงๆ
            setTransfer(prev => prev ? { ...prev, status: 'sending' } : null);
            
            resolve();
          }
        };

        socketRef.current?.on('relay-ready', onReady);
      });

      // 2. Send chunks
      const CHUNK_SIZE = 128 * 1024; // 128KB is safe for socket.io
      const fileSize = file.size;
      let offset = 0;
      let chunkCount = 0;

      while (offset < fileSize) {
        const sliceEnd = Math.min(offset + CHUNK_SIZE, fileSize);
        const chunk = await file.slice(offset, sliceEnd).arrayBuffer();
        
        socketRef.current.emit('relay-chunk', {
          to: peerId,
          fileId,
          chunk,
        });
        
        chunkCount++;
        offset += chunk.byteLength;

        // Update progress and yield to UI
        if (offset % (512 * 1024) < CHUNK_SIZE || offset === fileSize) {
          const progress = Math.round((offset / fileSize) * 100);
          console.log(`📊 Progress: ${progress}% (${chunkCount} chunks)`);
          
          // Check if transfer was aborted (e.g., due to relay-error)
          if (!socketRef.current || !socketRef.current.connected) {
            throw new Error('Socket disconnected during transfer');
          }
          
          setTransfer(prev => prev ? { ...prev, progress } : null);
          await new Promise(r => setTimeout(r, 0));
        }

        // Add a tiny delay to prevent overwhelming the socket queue
        // which could cause ping timeouts
        await new Promise(r => setTimeout(r, 5));
      }

      // 3. Send end marker
      console.log(`📤 Sending relay-end (${chunkCount} chunks total)`);
      socketRef.current.emit('relay-end', { to: peerId, fileId });
      console.log('✅ relay-end emitted');

      setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
      setTransferResult({
        success: true,
        fileName: file.name,
        fileSize: file.size,
        peerName: targetPeer.name,
        direction: 'sent',
      });

      setTimeout(() => setTransfer(null), 8000);
    } catch (err) {
      console.error('❌ Relay transfer error:', err);
      setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
      setTransferResult({
        success: false,
        fileName: file.name,
        fileSize: file.size,
        peerName: targetPeer.name,
        direction: 'sent',
      });
      setTimeout(() => setTransfer(null), 5000);
    } finally {
      releaseWakeLockFn();
    }
  }, [releaseWakeLockFn]);

  // Send file via WebRTC with retry logic
  const sendFileViaWebRTC = useCallback(async (peerId: string, file: File, fileId: string, targetPeer: Peer, retryCount = 0) => {
    console.log(`📤 Starting WebRTC transfer to ${peerId} (attempt ${retryCount + 1})`);
    console.log(`📊 File: ${file.name}, Size: ${file.size}, Type: ${file.type}`);

    // ตรวจสอบ device และ network
    const device = detectDevice();
    console.log('📱 Device info:', {
      isIOS: device.isIOS,
      isMobile: device.isMobile,
      supportsWebRTC: device.supportsWebRTC,
      connectionType: device.connectionType,
      isOnline: device.isOnline,
    });

    // ตรวจสอบว่าออนไลน์หรือไม่
    if (!device.isOnline) {
      throw new Error('network: No internet connection');
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(`file: ${validation.error}`);
    }

    // Request wake lock to prevent screen sleep
    await requestWakeLockFn();

    setTransfer({
      peerId,
      peerName: targetPeer.name,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'connecting', // เริ่มต้นด้วย connecting
    });

    try {
      // Create connection and data channel
      const pc = createPeerConnection(peerId);
      const dc = pc.createDataChannel('file-transfer', { 
        ordered: true,
        maxRetransmits: 30 // เพิ่ม retransmit สำหรับ network ไม่ดี
      });
      setupDataChannel(dc, peerId);

      console.log('📡 DataChannel created, state:', dc.readyState);

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (!socketRef.current) {
        throw new Error('Socket not connected');
      }

      console.log('📤 Sending RTC offer, ICE gathering state:', pc.iceGatheringState);
      
      // รอให้ ICE gathering เสร็จก่อนส่ง offer
      if (pc.iceGatheringState !== 'complete') {
        console.log('⏳ Waiting for ICE gathering...');
        await new Promise<void>((resolve) => {
          const checkGathering = () => {
            console.log('🧊 ICE gathering state:', pc.iceGatheringState);
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkGathering);
              console.log('✅ ICE gathering complete');
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkGathering);
          
          // Timeout หลัง 1.5 วินาที ส่งไปเลย (ลดจาก 3 วินาที)
          setTimeout(() => {
            pc.removeEventListener('icegatheringstatechange', checkGathering);
            console.log('⏱️ ICE gathering timeout, sending anyway');
            resolve();
          }, 1500);
        });
      }

      socketRef.current.emit('rtc-offer', { to: peerId, offer });
      console.log('📤 RTC offer sent, waiting for DataChannel to open...');

      // Wait for data channel to open with timeout + ICE state monitoring
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          clean();
          const iceState = pc.iceConnectionState;
          const gatherState = pc.iceGatheringState;
          const dcState = dc.readyState;
          console.error(`❌ Connection timeout - ICE: ${iceState}, Gathering: ${gatherState}, DC: ${dcState}`);
          reject(new Error(`Connection timeout (ICE: ${iceState}, DC: ${dcState})`));
        }, CONNECTION_TIMEOUT);

        const handleOpen = () => {
          clearTimeout(timeout);
          console.log('✅ DataChannel OPEN - ready to send file!');
          clean();
          resolve();
        };

        const handleError = (e: Event) => {
          clearTimeout(timeout);
          console.error('❌ DataChannel error event:', e);
          clean();
          reject(new Error('DataChannel error'));
        };
        
        const handleClose = () => {
          clearTimeout(timeout);
          console.error('❌ DataChannel closed before open, state was:', dc.readyState);
          clean();
          reject(new Error('DataChannel closed before open'));
        };

        // Monitor ICE state
        const handleIceFailure = () => {
          const state = pc.iceConnectionState;
          console.log(`🧊 ICE state: ${state}`);
          
          if (state === 'connected' || state === 'completed') {
            console.log('✅ ICE connected!');
          }
          
          if (state === 'failed') {
            console.error('❌ ICE failed, will retry...');
            setTimeout(() => {
              if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                clearTimeout(timeout);
                clean();
                reject(new Error('ICE connection failed'));
              }
            }, 3000);
          }
        };

        const clean = () => {
          dc.removeEventListener('open', handleOpen);
          dc.removeEventListener('error', handleError);
          dc.removeEventListener('close', handleClose);
          pc.removeEventListener('iceconnectionstatechange', handleIceFailure);
        };

        dc.addEventListener('open', handleOpen);
        dc.addEventListener('error', handleError);
        dc.addEventListener('close', handleClose);
        pc.addEventListener('iceconnectionstatechange', handleIceFailure);

        // Check if already open
        if (dc.readyState === 'open') {
          console.log('✅ DataChannel already open!');
          clearTimeout(timeout);
          clean();
          resolve();
        } else {
          console.log('⏳ DataChannel state:', dc.readyState, '- waiting for open...');
        }
      });

      // Send file info
      console.log('📤 Sending file-start');
      console.log(`📊 File details: ${file.name}, size: ${file.size}, type: ${file.type || 'unknown'}`);
      
      // เปลี่ยนสถานะเป็น sending เมื่อเริ่มส่งจริงๆ
      setTransfer(prev => prev ? { ...prev, status: 'sending' } : null);
      
      dc.send(JSON.stringify({
        type: 'file-start',
        fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      }));

      // Send file chunks with adaptive sizing — streaming from disk to avoid RAM overload
      const chunker = new AdaptiveChunker();
      const fileSize = file.size;
      let sent = 0;
      let offset = 0;

      // Set backpressure threshold - browser fires 'bufferedamountlow' when buffer drops below this
      dc.bufferedAmountLowThreshold = 65536; // 64KB

      // Use a larger read-ahead buffer to reduce slice calls
      const READ_AHEAD = 2 * 1024 * 1024; // 2MB read-ahead
      let readBuf: ArrayBuffer | null = null;
      let readBufOffset = 0; // offset inside readBuf

      while (offset < fileSize) {
        // Read ahead from file in larger blocks to reduce overhead
        if (!readBuf || readBufOffset >= readBuf.byteLength) {
          const end = Math.min(offset + READ_AHEAD, fileSize);
          try {
            readBuf = await file.slice(offset, end).arrayBuffer();
            readBufOffset = 0;
          } catch (sliceErr) {
            console.error('❌ Error reading file chunk:', sliceErr);
            throw new Error(`Failed to read file at offset ${offset}: ${sliceErr}`);
          }
        }

        // Get adaptive chunk size based on current buffer state
        const CHUNK_SIZE = chunker.adjustChunkSize(dc.bufferedAmount, dc.bufferedAmountLowThreshold);
        const sliceEnd = Math.min(readBufOffset + CHUNK_SIZE, readBuf.byteLength);
        const chunk = readBuf.slice(readBufOffset, sliceEnd);
        const chunkLen = chunk.byteLength;

        // Intelligent Backpressure: Wait ONLY if buffer is full
        if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
          await new Promise<void>((resolve, reject) => {
            let done = false;

            const cleanup = () => {
              if (done) return;
              done = true;
              dc.removeEventListener('bufferedamountlow', onLow);
              dc.removeEventListener('error', onError);
              dc.removeEventListener('close', onClose);
            };

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

            dc.addEventListener('bufferedamountlow', onLow);
            dc.addEventListener('error', onError);
            dc.addEventListener('close', onClose);

            // Failsafe: if state changed while setting up
            if (dc.readyState !== 'open') {
              onClose();
            } else if (dc.bufferedAmount <= dc.bufferedAmountLowThreshold) {
               // Fast path: if buffer already drained while setting up listeners
               onLow();
            }
          });
        }

        dc.send(chunk);
        sent += chunkLen;
        offset += chunkLen;
        readBufOffset += chunkLen;

        // Update progress — throttle to every ~500KB or on last chunk
        // AND yield to main thread so React can paint the UI
        if (sent % (512 * 1024) < chunkLen || sent === fileSize) {
          const progress = Math.round((sent / fileSize) * 100);
          setTransfer(prev => prev ? { ...prev, progress } : null);

          // Yield to the main thread so progress bar can actually repaint
          await new Promise(r => setTimeout(r, 0));
        }
      }

      // Free read buffer
      readBuf = null;

      // Send end marker
      console.log('📤 Sending file-end');
      dc.send(JSON.stringify({ type: 'file-end', fileId }));

      setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
      setTransferResult({
        success: true,
        fileName: file.name,
        fileSize: file.size,
        peerName: targetPeer.name,
        direction: 'sent',
      });

      // Release wake lock after transfer complete
      releaseWakeLockFn();

      // Let TransferProgress component handle the display timing
      setTimeout(() => setTransfer(null), 8000);

    } catch (err) {
      // Enhanced error handling
      const appError = handleError(err, 'sendFileViaWebRTC');
      logError(appError, `File: ${file.name}, Attempt: ${retryCount + 1}`);

      // Release wake lock on error
      releaseWakeLockFn();

      // Retry logic with exponential backoff
      if (retryCount < MAX_RETRIES && appError.canRetry) {
        const delay = RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`🔄 Retrying transfer (${retryCount + 1}/${MAX_RETRIES}) in ${delay}ms...`);
        console.log(`💡 Reason: ${appError.userMessage}`);
        
        setTransfer(prev => prev ? { 
          ...prev, 
          status: 'sending', 
          progress: 0 
        } : null);

        // Clean up failed connection
        try { peerConnectionsRef.current.get(peerId)?.close(); } catch { /* ignore */ }
        peerConnectionsRef.current.delete(peerId);
        dataChannelsRef.current.delete(peerId);
        pendingIceCandidatesRef.current.delete(peerId);

        // Wait before retry
        await new Promise(r => setTimeout(r, delay));

        // Retry
        return sendFileViaWebRTC(peerId, file, fileId, targetPeer, retryCount + 1);
      }

      // Fallback to relay with user notification
      console.warn('⚠️ WebRTC failed, falling back to Server Relay...');
      console.log(`💡 ${appError.suggestedAction || 'Using server relay'}`);
      
      // Notify user about fallback
      setTransfer(prev => prev ? { 
        ...prev, 
        status: 'sending', 
        progress: 0,
        connectionType: 'relay' 
      } : null);
      
      return sendFileViaRelay(peerId, file, fileId, targetPeer);
    }
  }, [createPeerConnection, setupDataChannel, requestWakeLockFn, releaseWakeLockFn, sendFileViaRelay]);

  // Keep callback refs in sync (stable references for useEffect)
  useEffect(() => { sendFileViaRelayRef.current = sendFileViaRelay; }, [sendFileViaRelay]);
  useEffect(() => { sendFileViaWebRTCRef.current = sendFileViaWebRTC; }, [sendFileViaWebRTC]);

  const sendTextViaWebRTC = useCallback(async (peerId: string, text: string, targetPeer: Peer) => {
    console.log(`📤 Starting Text transfer to ${peerId}`);
    
    // Check text size limit (1MB max for safety)
    const textSize = new Blob([text]).size;
    if (textSize > 1024 * 1024) {
      console.error('❌ Text too large:', textSize);
      setTransferResult({
        success: false,
        fileName: 'ข้อความใหญ่เกินไป (สูงสุด 1MB)',
        fileSize: textSize,
        peerName: targetPeer.name,
        direction: 'sent',
      });
      setTimeout(() => setTransferResult(null), 5000);
      return;
    }
    
    // Set pending UI state to inform user we are trying to connect
    setTransferResult(null);
    setTransfer({
      peerId,
      peerName: targetPeer.name,
      fileName: 'กำลังส่งข้อความ...',
      fileSize: textSize,
      progress: 0,
      status: 'sending',
    });

    try {
      const pc = peerConnectionsRef.current.get(peerId) || createPeerConnection(peerId);
      
      let dc = dataChannelsRef.current.get(peerId);
      if (!dc || dc.readyState === 'closed' || dc.readyState === 'closing') {
        dc = pc.createDataChannel('text-transfer', { ordered: true });
        dataChannelsRef.current.set(peerId, dc);
        setupDataChannel(dc, peerId);
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        if (!socketRef.current) throw new Error('Socket not connected');
        socketRef.current.emit('rtc-offer', { to: peerId, offer });
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 20000); // Increased to 20s for long text
          
          const handleOpen = () => { clearTimeout(timeout); clean(); resolve(); };
          const handleClose = () => { clearTimeout(timeout); clean(); reject(new Error('DataChannel closed before open')); };
          const handleError = () => { clearTimeout(timeout); clean(); reject(new Error('DataChannel error')); };
          
          const clean = () => {
            dc!.removeEventListener('open', handleOpen);
            dc!.removeEventListener('close', handleClose);
            dc!.removeEventListener('error', handleError);
          };
          
          dc!.addEventListener('open', handleOpen);
          dc!.addEventListener('close', handleClose);
          dc!.addEventListener('error', handleError);

          if (dc!.readyState === 'open') { clearTimeout(timeout); clean(); resolve(); }
        });
      }

      // For long text, split into chunks to avoid DataChannel size limits
      const MAX_CHUNK_SIZE = 16000; // Safe size for all browsers
      if (text.length > MAX_CHUNK_SIZE) {
        const textId = uuidv4();
        const chunks = Math.ceil(text.length / MAX_CHUNK_SIZE);
        
        // Send start message
        dc.send(JSON.stringify({
          type: 'text-start',
          textId,
          totalChunks: chunks,
          totalLength: text.length
        }));

        // Send chunks with progress updates
        for (let i = 0; i < chunks; i++) {
          const chunk = text.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE);
          dc.send(JSON.stringify({
            type: 'text-chunk',
            textId,
            chunkIndex: i,
            chunk
          }));
          
          // Update progress
          const progress = Math.round(((i + 1) / chunks) * 100);
          setTransfer(prev => prev ? { ...prev, progress } : null);
          
          // Small delay to prevent overwhelming the channel
          await new Promise(r => setTimeout(r, 10));
        }

        // Send end message
        dc.send(JSON.stringify({
          type: 'text-end',
          textId
        }));
        
        console.log(`📤 Sent long text in ${chunks} chunks`);
      } else {
        // Short text - send directly
        dc.send(JSON.stringify({
          type: 'text-message',
          payload: text
        }));
        console.log('📤 Sent text message');
      }
      
      setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
      setTransferResult({
        success: true,
        fileName: 'ข้อความ/ลิงก์',
        fileSize: textSize,
        peerName: targetPeer.name,
        direction: 'sent',
        type: 'text',
        textContent: text,
      });
      setTimeout(() => setTransfer(null), 3000);

    } catch (err) {
      console.error('❌ Text transfer error:', err);
      
      // Notify user of failure
      setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
      setTransferResult({
        success: false,
        fileName: 'ข้อความ/ลิงก์',
        fileSize: textSize,
        peerName: targetPeer.name,
        direction: 'sent',
      });
      
      // Clean up connection to force a fresh ICE restart next time
      peerConnectionsRef.current.get(peerId)?.close();
      peerConnectionsRef.current.delete(peerId);
      dataChannelsRef.current.delete(peerId);
      
      setTimeout(() => setTransfer(null), 5000);
    }
  }, [createPeerConnection, setupDataChannel]);

  // Initialize socket connection
  useEffect(() => {
    // Don't connect if in In-App Browser
    if (typeof window !== 'undefined' && sessionStorage.getItem('purrdrop_inapp') === 'true') {
      console.log('🚫 In-App Browser detected, not connecting');
      setConnectionStatus('disconnected');
      return;
    }

    // Fetch ICE servers from API
    fetch('/api/ice-servers')
      .then(res => res.json())
      .then(data => {
        iceServersRef.current = data.iceServers;
        console.log('✅ ICE servers loaded from API');
      })
      .catch(err => {
        console.error('❌ Failed to load ICE servers:', err);
        // Fallback STUN servers already set in createPeerConnection
      });

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
      
      // Clean up any active receiving transfers
      receivingFilesRef.current.forEach((receiving) => {
        console.log(`🧹 Aborting receive for ${receiving.info.name} due to disconnect`);
        if (receiving.streamWriter) {
          receiving.streamWriter.abort();
        }
      });
      if (receivingFilesRef.current.size > 0) {
        receivingFilesRef.current.clear();
        setTransfer(prev => {
          if (prev && (prev.status === 'receiving' || prev.status === 'sending')) {
            return { ...prev, status: 'error' };
          }
          return prev;
        });
        setTransferResult({
          success: false,
          fileName: 'Transfer interrupted',
          fileSize: 0,
          peerName: '',
          direction: 'received',
        });
        releaseWakeLockFn();
        setTimeout(() => setTransfer(null), 5000);
      }
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
      
      // Restore previous mode if not public
      if (discoveryModeRef.current !== 'public') {
        console.log('🔄 Restoring previous mode state on reconnect:', discoveryModeRef.current);
        socket.emit('set-mode', {
          mode: discoveryModeRef.current,
          roomCode: roomCodeRef.current,
          password: roomPasswordRef.current
        });
      }
    });

    socket.on('reconnect_failed', () => {
      console.log('❌ Socket reconnection failed');
      setConnectionStatus('disconnected');
    });

    socket.on('peers', (peerList: PeerWithMeta[]) => {
      const filtered = peerList.filter(p => p.id !== sessionId);
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
      
      // Update refs for reconnection
      discoveryModeRef.current = mode;
      roomCodeRef.current = code;
      roomPasswordRef.current = pwd;

      if (netName) setNetworkName(netName);
      // Don't clear roomError here — it races with room-error event
      // roomError is cleared by its own timeout in the room-error handler
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
      // Check if there's an active transfer with this peer
      const currentTransfer = receivingFilesRef.current;
      for (const [fileId, receiving] of currentTransfer.entries()) {
        if (receiving.senderId === peerId) {
          console.log(`❌ Sender ${peerId} left during transfer of ${receiving.info.name}`);
          if (receiving.streamWriter) {
            receiving.streamWriter.abort();
          }
          currentTransfer.delete(fileId);
          setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
          setTransferResult({
            success: false,
            fileName: receiving.info.name,
            fileSize: receiving.info.size,
            peerName: peersRef.current.find(p => p.id === peerId)?.name || 'ไม่ทราบชื่อ',
            direction: 'received',
          });
          releaseWakeLockFn();
          setTimeout(() => setTransfer(null), 5000);
        }
      }
      
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

    socket.on('file-accept', async ({ from, fileId }: { from: string; fileId: string }) => {
      console.log('✅ File accepted by:', from);
      const pending = pendingFilesRef.current.get(fileId);
      if (pending) {
        console.log(`📤 Starting file transfer: ${pending.file.name} (${pending.file.size} bytes)`);
        
        // ลบออกจาก pending ก่อนส่ง
        pendingFilesRef.current.delete(fileId);
        
        // เช็คว่าควรใช้ relay หรือไม่ (ส่ง discoveryMode และ fileSize)
        const useRelay = shouldUseRelay(discoveryModeRef.current, pending.file.size);
        console.log(`🔀 Transfer mode: ${useRelay ? 'Relay' : 'WebRTC'}`);
        console.log(`📱 Device info:`, detectDevice());
        console.log(`📊 Discovery mode: ${discoveryModeRef.current}, File size: ${(pending.file.size / 1024 / 1024).toFixed(2)}MB`);
        
        // ส่งไฟล์ — ใช้ ref เพื่อไม่ให้ useEffect re-run
        try {
          if (useRelay) {
            console.log('📤 Calling sendFileViaRelay...');
            await sendFileViaRelayRef.current!(from, pending.file, fileId, pending.peer);
          } else {
            console.log('📤 Calling sendFileViaWebRTC...');
            await sendFileViaWebRTCRef.current!(from, pending.file, fileId, pending.peer);
          }
        } catch (err) {
          console.error('❌ Failed to start file transfer:', err);
          setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
        }
      } else {
        console.error('❌ No pending file found for fileId:', fileId);
      }
    });

    socket.on('file-reject', () => {
      console.log('❌ File rejected');
      setTransfer(null);
    });


    // --- Relay Fallback Receivers ---
    socket.on('relay-start', async (data: { from: string, fileId: string, name: string, size: number, mimeType: string }) => {
      console.log('📥 Relay start received:', data.name);
      console.log('📊 Relay file info:', {
        fileId: data.fileId,
        from: data.from,
        size: `${(data.size / 1024 / 1024).toFixed(2)}MB`,
        mimeType: data.mimeType
      });
      
      const senderPeer = peersRef.current.find(p => p.id === data.from);
      
      const useStreaming = shouldUseStreaming(data.size);
      let streamWriter: StreamWriter | undefined;
      
      if (useStreaming) {
        console.log(`📁 Large file (${(data.size / 1024 / 1024).toFixed(1)}MB) - using streaming (Relay)`);
        try {
          streamWriter = await createStreamWriter(data.name, data.mimeType, data.size);
        } catch (err) {
          console.log('Streaming not available, using memory buffer:', err);
        }
      }

      receivingFilesRef.current.set(data.fileId, {
        chunks: [],
        info: { name: data.name, size: data.size, type: data.mimeType },
        streamWriter,
        useStreaming: !!streamWriter,
        received: 0,
        senderId: data.from
      });

      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => {
          wakeLockRef.current = lock;
        }).catch(() => { });
      }

      setTransfer({
        peerId: data.from,
        peerName: senderPeer?.name || 'ไม่ทราบชื่อ',
        fileName: data.name,
        fileSize: data.size,
        progress: 0,
        status: 'receiving',
        connectionType: 'relay',
      });

      // ACK กลับไปหา Sender ว่าเรา setup เสร็จและพร้อมรับ chunks แล้ว
      console.log('📤 Sending relay-ready ACK to sender');
      socket.emit('relay-ready', { to: data.from, fileId: data.fileId });
    });

    socket.on('relay-chunk', async (data: { fileId: string, chunk: ArrayBuffer }) => {
      const receiving = receivingFilesRef.current.get(data.fileId);
      if (!receiving) return;

      receiving.received += data.chunk.byteLength;
      
      // Track last chunk time for inactivity timeout
      (receiving as any)._lastChunkTime = Date.now();

      if (receiving.streamWriter) {
        try {
          await receiving.streamWriter.write(new Uint8Array(data.chunk) as unknown as ArrayBuffer);
        } catch (err) {
          console.error('Error writing stream chunk (Relay):', err);
        }
      } else {
        receiving.chunks.push(data.chunk);
      }

      // Update progress UI moderately to not overload React
      if (receiving.received % (512 * 1024) < data.chunk.byteLength || receiving.received === receiving.info.size) {
        const progress = Math.round((receiving.received / receiving.info.size) * 100);
        setTransfer(prev => prev ? { ...prev, progress } : null);
      }
    });

    socket.on('relay-end', async (data: { fileId: string }) => {
      console.log('✅ Relay end received for fileId:', data.fileId);
      console.log('📋 Current receiving files:', Array.from(receivingFilesRef.current.keys()));
      
      const receiving = receivingFilesRef.current.get(data.fileId);
      if (!receiving) {
        console.error('❌ No receiving file found for:', data.fileId);
        console.error('💡 This usually means relay-start was rejected by server or never arrived');
        return;
      }

      console.log(`📊 Relay complete - Chunks: ${receiving.chunks.length}, Total received: ${receiving.received} bytes, Expected: ${receiving.info.size} bytes`);
      
      // Check if we received all data
      if (receiving.received < receiving.info.size) {
        const missing = receiving.info.size - receiving.received;
        const percentMissing = ((missing / receiving.info.size) * 100).toFixed(1);
        console.error(`❌ INCOMPLETE TRANSFER: Missing ${missing} bytes (${percentMissing}%)`);
        console.error(`💡 This causes "Unexpected end of archive" errors`);
        
        // Show error to user
        setTransfer(prev => prev ? { ...prev, status: 'error' } : null);
        setTransferResult({
          success: false,
          fileName: receiving.info.name,
          fileSize: receiving.info.size,
          peerName: peersRef.current.find(p => p.id === receiving.senderId)?.name || 'ไม่ทราบชื่อ',
          direction: 'received',
        });
        
        receivingFilesRef.current.delete(data.fileId);
        releaseWakeLockFn();
        setTimeout(() => setTransfer(null), 5000);
        return;
      }

      if (receiving.streamWriter) {
        await receiving.streamWriter.close();
        console.log('📁 Stream closed - file saved (Relay)');
        setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
      } else {
        // Memory mode - save blob
        console.log('💾 Saving file from memory buffer (Relay)');
        console.log(`📦 Creating blob with ${receiving.chunks.length} chunks, type: ${receiving.info.type}`);
        
        const blob = new Blob(receiving.chunks, { type: receiving.info.type });
        console.log(`📦 Blob created - Size: ${blob.size}, Type: ${blob.type}`);
        
        // Verify blob size matches expected
        if (blob.size !== receiving.info.size) {
          console.error(`❌ SIZE MISMATCH: Blob is ${blob.size} bytes, expected ${receiving.info.size} bytes`);
        } else {
          console.log('✅ Size verification passed');
        }
        
        // Use downloadBlob helper
        try {
          downloadBlob(blob, receiving.info.name);
          console.log('✅ Download triggered successfully');
        } catch (err) {
          console.error('❌ Download failed:', err);
          // Fallback to manual download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = receiving.info.name;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
        }
        
        setTransfer(prev => prev ? { ...prev, progress: 100, status: 'complete' } : null);
      }

      const senderPeer = peersRef.current.find(p => p.id === receiving.senderId);
      setTransferResult({
        success: true,
        fileName: receiving.info.name,
        fileSize: receiving.info.size,
        peerName: senderPeer?.name || 'ไม่ทราบชื่อ',
        direction: 'received',
      });

      // Vibrate on complete
      if (navigator.vibrate) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch {
          // ignore
        }
      }

      receivingFilesRef.current.delete(data.fileId);
      releaseWakeLockFn();
      setTimeout(() => setTransfer(null), 8000);
    });

    // Handle relay errors (e.g., file too large)
    socket.on('relay-error', (data: { fileId: string, error: string, suggestedAction?: string }) => {
      console.error('❌ Relay error:', data.error);
      
      // Clean up any pending transfer
      const pendingFile = pendingFilesRef.current.get(data.fileId);
      if (pendingFile) {
        pendingFilesRef.current.delete(data.fileId);
      }
      
      // Clean up any receiving file
      const receiving = receivingFilesRef.current.get(data.fileId);
      if (receiving) {
        if (receiving.streamWriter) {
          receiving.streamWriter.close().catch(() => {});
        }
        receivingFilesRef.current.delete(data.fileId);
      }
      
      // Update transfer status to error
      setTransfer(prev => {
        if (prev && prev.status === 'sending') {
          return { ...prev, status: 'error' };
        }
        return prev;
      });
      
      // Show error result
      setTransferResult({
        success: false,
        fileName: pendingFile?.file.name || 'Unknown file',
        fileSize: pendingFile?.file.size || 0,
        peerName: pendingFile?.peer.name || 'Unknown',
        direction: 'sent',
      });
      
      // Release wake lock
      releaseWakeLockFn();
      
      // Clear transfer UI after delay
      setTimeout(() => setTransfer(null), 5000);
    });
    // --------------------------------
    socket.on('rtc-offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      console.log('📥 RTC offer from:', from);
      try {
        // สร้าง PeerConnection (จะมี ondatachannel listener อยู่แล้ว)
        const pc = createPeerConnection(from);
        
        console.log('📥 Setting remote description (offer)');
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Flush any ICE candidates that arrived before remoteDescription was set
        await flushIceCandidates(from, pc);
        
        console.log('📤 Creating answer');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        console.log('📤 Sending answer, ICE gathering state:', pc.iceGatheringState);
        
        // รอ ICE gathering เสร็จก่อนส่ง answer (เหมือนฝั่งส่ง)
        if (pc.iceGatheringState !== 'complete') {
          console.log('⏳ Waiting for ICE gathering (receiver)...');
          await new Promise<void>((resolve) => {
            const checkGathering = () => {
              console.log('🧊 ICE gathering state (receiver):', pc.iceGatheringState);
              if (pc.iceGatheringState === 'complete') {
                pc.removeEventListener('icegatheringstatechange', checkGathering);
                console.log('✅ ICE gathering complete (receiver)');
                resolve();
              }
            };
            pc.addEventListener('icegatheringstatechange', checkGathering);
            
            // Timeout 3 วินาที
            // Timeout หลัง 1.5 วินาที (ลดจาก 3 วินาที)
            setTimeout(() => {
              pc.removeEventListener('icegatheringstatechange', checkGathering);
              console.log('⏱️ ICE gathering timeout (receiver), sending anyway');
              resolve();
            }, 1500);
          });
        }
        
        socket.emit('rtc-answer', { to: from, answer });
        console.log('📤 RTC answer sent');
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
          // Flush any ICE candidates that arrived before remoteDescription was set
          await flushIceCandidates(from, pc);
        }
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    });

    socket.on('rtc-ice', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      try {
        const pc = peerConnectionsRef.current.get(from);
        if (pc && candidate) {
          // Queue candidates if remoteDescription not yet set (race condition fix)
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            console.log('🧊 Queuing ICE candidate (waiting for remoteDescription)');
            const queue = pendingIceCandidatesRef.current.get(from) || [];
            queue.push(candidate);
            pendingIceCandidatesRef.current.set(from, queue);
          }
        } else if (!pc && candidate) {
          // PeerConnection not yet created — queue for later
          console.log('🧊 Queuing ICE candidate (no PeerConnection yet)');
          const queue = pendingIceCandidatesRef.current.get(from) || [];
          queue.push(candidate);
          pendingIceCandidatesRef.current.set(from, queue);
        }
      } catch (err) {
        console.error('Error adding ICE:', err);
      }
    });

    return () => {
      socket.close();
      const pcs = peerConnectionsRef.current;
      const dcs = dataChannelsRef.current;
      pcs.forEach(pc => pc.close());
      pcs.clear();
      dcs.clear();
      pendingIceCandidatesRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPeerConnection, flushIceCandidates, releaseWakeLockFn]);

  const sendFile = useCallback((peer: Peer, file: File) => {
    try {
      // Check socket connection
      if (!socketRef.current) {
        throw new Error('network: Socket not connected');
      }

      // Check online status
      if (!navigator.onLine) {
        throw new Error('network: No internet connection');
      }

      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(`file: ${validation.error}`);
      }

      // Detect MIME type
      const mimeType = detectImageMimeType(file);
      console.log(`📷 File type: ${mimeType} for ${file.name}`);

      const fileId = uuidv4();
      pendingFilesRef.current.set(fileId, { file, peer });

      // Show pending state
      setTransfer({
        peerId: peer.id,
        peerName: peer.name,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        status: 'pending',
      });

      console.log(`📤 Sending file offer: ${file.name} (${mimeType}) to ${peer.name}`);
      socketRef.current.emit('file-offer', {
        to: peer.id,
        from: myPeerRef.current,
        file: { name: file.name, size: file.size, type: mimeType },
        fileId,
      });
    } catch (err) {
      const appError = handleError(err, 'sendFile');
      logError(appError, `File: ${file?.name || 'unknown'}`);
      
      setTransferResult({
        success: false,
        fileName: file?.name || 'Unknown',
        fileSize: file?.size || 0,
        peerName: peer.name,
        direction: 'sent',
      });
      
      setTransfer(null);
    }
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

  const clearTextMessage = useCallback(() => {
    setTextMessage(null);
  }, []);

  const cancelTransfer = useCallback(() => {
    const pcs = peerConnectionsRef.current;
    const dcs = dataChannelsRef.current;
    
    // Close all peer connections
    pcs.forEach((pc) => {
      pc.close();
    });
    pcs.clear();
    dcs.clear();
    pendingFilesRef.current.clear();

    // Abort any streaming writers
    receivingFilesRef.current.forEach(receiving => {
      if (receiving.streamWriter) {
        receiving.streamWriter.abort();
      }
    });
    receivingFilesRef.current.clear();

    releaseWakeLockFn();
    setTransfer(null);
    setFileOffer(null);
  }, [releaseWakeLockFn]);

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
    textMessage,
    transfer,
    transferResult,
    sendFile,
    sendText: sendTextViaWebRTC,
    acceptFile,
    rejectFile,
    updateName,
    updateEmoji,
    clearTransferResult,
    clearTextMessage,
    cancelTransfer,
    joinRoom,
    createRoom,
    setMode,
  };
}
