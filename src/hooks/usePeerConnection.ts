'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { AdaptiveChunker } from '@/lib/adaptiveChunker';
import { Peer, assignCritter, getDeviceName, generateCuteName } from '@/lib/critters';
import { createStreamWriter, shouldUseStreaming, StreamWriter, FileTooLargeError } from '@/lib/streamSaver';

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
  status: 'pending' | 'sending' | 'receiving' | 'complete' | 'saving' | 'error';
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

          // Clean up and wait for new connection initiated by other side or retry
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
      iceServers: iceServersRef.current.length > 0 ? iceServersRef.current : [
        // Fallback STUN servers if API fails
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10, // Pre-fetch candidates for faster connection
      iceTransportPolicy: 'all', // Try all routes (relay, srflx, host)
      bundlePolicy: 'max-bundle', // Bundle all media on single transport
      rtcpMuxPolicy: 'require', // Multiplex RTP and RTCP
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
      
      // Log failed state for debugging
      if (pc.iceConnectionState === 'failed') {
        console.error('❌ ICE connection failed - NAT traversal unsuccessful');
        pc.getStats().then(stats => {
          console.log('📊 Connection stats:', Array.from(stats.values()));
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

        const handleOpen = () => {
          clearTimeout(timeout);
          console.log('✅ DataChannel ready for sending');
          clean();
          resolve();
        };

        const handleError = () => {
          clearTimeout(timeout);
          clean();
          reject(new Error('DataChannel error'));
        };
        
        const handleClose = () => {
          clearTimeout(timeout);
          clean();
          reject(new Error('DataChannel closed before open'));
        };

        const clean = () => {
          dc.removeEventListener('open', handleOpen);
          dc.removeEventListener('error', handleError);
          dc.removeEventListener('close', handleClose);
        };

        dc.addEventListener('open', handleOpen);
        dc.addEventListener('error', handleError);
        dc.addEventListener('close', handleClose);

        if (dc.readyState === 'open') {
          clean();
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

      // Send file chunks with adaptive sizing
      const chunker = new AdaptiveChunker();
      const arrayBuffer = await file.arrayBuffer();
      let sent = 0;

      // Set backpressure threshold - browser fires 'bufferedamountlow' when buffer drops below this
      dc.bufferedAmountLowThreshold = 65536; // 64KB

      for (let i = 0; i < arrayBuffer.byteLength; ) {
        // Get adaptive chunk size based on current buffer state
        const CHUNK_SIZE = chunker.adjustChunkSize(dc.bufferedAmount, dc.bufferedAmountLowThreshold);
        const chunk = arrayBuffer.slice(i, Math.min(i + CHUNK_SIZE, arrayBuffer.byteLength));

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
        sent += chunk.byteLength;
        i += CHUNK_SIZE;

        // Update progress every few chunks to prevent React from lagging
        if (i % (CHUNK_SIZE * 10) === 0 || sent === arrayBuffer.byteLength) {
          const progress = Math.round((sent / arrayBuffer.byteLength) * 100);
          setTransfer(prev => prev ? { ...prev, progress } : null);
        }
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
        direction: 'sent',
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
        direction: 'sent',
      });
      setTimeout(() => setTransfer(null), 5000);
    }
  }, [createPeerConnection, setupDataChannel, requestWakeLock, releaseWakeLock]);

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
      const pcs = peerConnectionsRef.current;
      const dcs = dataChannelsRef.current;
      pcs.forEach(pc => pc.close());
      pcs.clear();
      dcs.clear();
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
