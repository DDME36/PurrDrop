'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Clouds } from '@/components/Clouds';
import { Header } from '@/components/Header';
import { MyInfo } from '@/components/MyInfo';
import { ModeSelector } from '@/components/ModeSelector';
import { EmptyState } from '@/components/EmptyState';
import { PeersGrid } from '@/components/PeersGrid';
import { TransferProgress } from '@/components/TransferProgress';
import { Confetti, ConfettiRef } from '@/components/Confetti';
import { Toast, ToastRef } from '@/components/Toast';
import { Footer } from '@/components/Footer';
import { BrowserWarning } from '@/components/BrowserWarning';
import {
  FileOfferModal,
  NameModal,
  EmojiModal,
  QRModal,
  HelpModal,
  HistoryModal,
  FeedbackModal,
} from '@/components/modals';
import { useSound } from '@/hooks/useSound';
import { usePeerConnection } from '@/hooks/usePeerConnection';
import { useTheme } from '@/hooks/useTheme';
import { useNotification } from '@/hooks/useNotification';
import { Peer } from '@/lib/critters';
import { getHistory, addToHistory, TransferRecord } from '@/lib/transferHistory';

export default function Home() {
  const {
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
    setMode,
  } = usePeerConnection();

  const { muted, toggle: toggleMute, play, vibrate } = useSound();
  const { isDark, toggleTheme } = useTheme();
  const { requestPermission, notifyFileOffer, notifyTransferComplete, notifyPeerJoined } = useNotification();

  const [showNameModal, setShowNameModal] = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [newPeerIds, setNewPeerIds] = useState<Set<string>>(new Set());
  const [baseUrl, setBaseUrl] = useState('');
  const [history, setHistory] = useState<TransferRecord[]>([]);
  const [initialModeSet, setInitialModeSet] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedPeerRef = useRef<Peer | null>(null);
  const confettiRef = useRef<ConfettiRef>(null);
  const toastRef = useRef<ToastRef>(null);
  const prevPeerIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory());
  }, []);

  // Handle URL params for mode/room on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set base URL (without params)
    const url = new URL(window.location.href);
    url.search = '';
    setBaseUrl(url.toString());

    // Check for mode params
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const roomParam = params.get('room');

    if (modeParam && !initialModeSet && connected) {
      if (modeParam === 'wifi') {
        setMode('wifi');
        toastRef.current?.show('เข้าโหมด WiFi แล้ว', 'info');
      } else if (modeParam === 'private' && roomParam) {
        setMode('private', roomParam);
        toastRef.current?.show(`เข้าห้อง ${roomParam} แล้ว`, 'info');
      }
      setInitialModeSet(true);

      // Clean URL params
      window.history.replaceState({}, '', url.toString());
    }
  }, [connected, initialModeSet, setMode]);

  // Request notification permission on first interaction
  useEffect(() => {
    const handleInteraction = () => {
      requestPermission();
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, [requestPermission]);

  // Track new peers for animation
  useEffect(() => {
    const currentIds = new Set(peers.map(p => p.id));
    const newIds = new Set<string>();

    // ถ้าเป็นครั้งแรก ให้ข้าม animation .entering ไปเลย
    // เพื่อป้องกัน double flash (cardAppear + cardEnter ตีกัน)
    if (isFirstLoadRef.current) {
      if (currentIds.size > 0) {
        prevPeerIdsRef.current = currentIds;
        isFirstLoadRef.current = false;
      }
      return;
    }

    currentIds.forEach(id => {
      if (!prevPeerIdsRef.current.has(id)) {
        newIds.add(id);
        const newPeer = peers.find(p => p.id === id);
        if (newPeer) {
          notifyPeerJoined(newPeer.name);
        }
      }
    });

    if (newIds.size > 0) {
      setNewPeerIds(newIds);
      play('connect');
      setTimeout(() => setNewPeerIds(new Set()), 1000);
    }

    prevPeerIdsRef.current = currentIds;
  }, [peers, play, notifyPeerJoined]);

  // Register service worker for PWA
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  // Handle file offer notification
  useEffect(() => {
    if (fileOffer) {
      notifyFileOffer(fileOffer.from.name, fileOffer.file.name);
      play('notification');
      vibrate([100, 50, 100]);
    }
  }, [fileOffer, notifyFileOffer, play, vibrate]);

  // Handle transfer complete
  useEffect(() => {
    if (transfer?.status === 'complete') {
      play('success');
      confettiRef.current?.burst();
      notifyTransferComplete(transfer.fileName, 'received');
    }
  }, [transfer?.status, transfer?.fileName, play, notifyTransferComplete]);

  // Handle transfer result (both send and receive)
  useEffect(() => {
    if (transferResult) {
      if (transferResult.success) {
        // Add to history
        addToHistory({
          fileName: transferResult.fileName,
          fileSize: transferResult.fileSize,
          peerName: transferResult.peerName,
          direction: 'sent',
          success: true,
        });
        setHistory(getHistory());
      }
      clearTransferResult();
    }
  }, [transferResult, clearTransferResult]);

  // Smart ZIP - ฉลาดเลือกว่าจะบีบหรือไม่
  // Smart ZIP - ฉลาดเลือกว่าจะบีบหรือไม่
  // MAX 100MB สำหรับ ZIP เพื่อป้องกัน RAM เต็ม
  const MAX_ZIP_SIZE = 100 * 1024 * 1024;

  // Import type for use in page (can also define locally if import fails but better to share)
  // Assuming we can import from PeerCard, but circular deps might be an issue if PeerCard imports peers
  // Let's redefine locally to be safe or import if clean. 
  // Given previous steps, let's look at PeerCard.tsx content again. It exports FileWithContext.

  const createZipFile = useCallback(async (filesWithContext: { file: File, path: string }[]): Promise<File | null> => {
    // ตรวจสอบขนาดรวมก่อน
    const totalSize = filesWithContext.reduce((acc, item) => acc + item.file.size, 0);

    // ถ้าใหญ่เกิน limit ให้ return null (จะส่งทีละไฟล์แทน)
    if (totalSize > MAX_ZIP_SIZE) {
      console.warn(`⚠️ Total size ${(totalSize / 1024 / 1024).toFixed(1)}MB exceeds ZIP limit`);
      return null;
    }

    // ไฟล์ที่บีบแล้วไม่เล็กลง (already compressed)
    const SKIP_COMPRESS_TYPES = new Set([
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
      // Video
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
      // Audio
      'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/aac',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      'application/gzip', 'application/x-bzip2',
      // Documents (already compressed)
      'application/pdf',
    ]);

    const SKIP_COMPRESS_EXT = new Set([
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic',
      '.mp4', '.mkv', '.avi', '.mov', '.webm',
      '.mp3', '.aac', '.ogg', '.m4a', '.flac',
      '.zip', '.rar', '.7z', '.gz', '.bz2', '.xz',
      '.pdf', '.docx', '.xlsx', '.pptx',
    ]);

    const shouldCompress = (file: File): boolean => {
      if (SKIP_COMPRESS_TYPES.has(file.type)) return false;
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (SKIP_COMPRESS_EXT.has(ext)) return false;
      // ไฟล์ใหญ่กว่า 50MB ไม่บีบ (กัน CPU ค้าง)
      if (file.size > 50 * 1024 * 1024) return false;
      return true;
    };

    console.log(`📦 Creating ZIP: ${filesWithContext.length} files, ${(totalSize / 1024 / 1024).toFixed(1)}MB`);

    let zipSize = 22;
    const fileInfos: { name: Uint8Array; data: Uint8Array; crc: number; compressed: boolean }[] = [];
    const encoder = new TextEncoder();

    const crc32Table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crc32Table[i] = c >>> 0;
    }

    const calcCrc32 = (data: Uint8Array): number => {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xFF];
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    };

    for (const { file, path } of filesWithContext) {
      const data = new Uint8Array(await file.arrayBuffer());
      // Use the preserved path name instead of just file.name
      const name = encoder.encode(path);
      const crc = calcCrc32(data);
      const compress = shouldCompress(file);

      console.log(`📦 ${path}: ${compress ? 'compress' : 'store'} (${file.type || 'unknown'})`);

      fileInfos.push({ name, data, crc, compressed: compress });
      zipSize += 30 + name.length + data.length;
      zipSize += 46 + name.length;
    }

    const buffer = new ArrayBuffer(zipSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let pos = 0;
    let cdStart = 0;

    // Local file headers + data
    for (const { name, data, crc } of fileInfos) {
      view.setUint32(pos, 0x04034b50, true); pos += 4; // signature
      view.setUint16(pos, 20, true); pos += 2; // version
      view.setUint16(pos, 0, true); pos += 2; // flags
      view.setUint16(pos, 0, true); pos += 2; // compression (0 = store)
      view.setUint16(pos, 0, true); pos += 2; // mod time
      view.setUint16(pos, 0, true); pos += 2; // mod date
      view.setUint32(pos, crc, true); pos += 4;
      view.setUint32(pos, data.length, true); pos += 4; // compressed size
      view.setUint32(pos, data.length, true); pos += 4; // uncompressed size
      view.setUint16(pos, name.length, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2; // extra field length
      bytes.set(name, pos); pos += name.length;
      bytes.set(data, pos); pos += data.length;
    }

    cdStart = pos;

    // Central directory
    let localOffset = 0;
    for (const { name, data, crc } of fileInfos) {
      view.setUint32(pos, 0x02014b50, true); pos += 4;
      view.setUint16(pos, 20, true); pos += 2;
      view.setUint16(pos, 20, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint32(pos, crc, true); pos += 4;
      view.setUint32(pos, data.length, true); pos += 4;
      view.setUint32(pos, data.length, true); pos += 4;
      view.setUint16(pos, name.length, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint32(pos, 0, true); pos += 4;
      view.setUint32(pos, localOffset, true); pos += 4;
      bytes.set(name, pos); pos += name.length;
      localOffset += 30 + name.length + data.length;
    }

    const cdSize = pos - cdStart;

    // End of central directory
    view.setUint32(pos, 0x06054b50, true); pos += 4;
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, fileInfos.length, true); pos += 2;
    view.setUint16(pos, fileInfos.length, true); pos += 2;
    view.setUint32(pos, cdSize, true); pos += 4;
    view.setUint32(pos, cdStart, true); pos += 4;
    view.setUint16(pos, 0, true);

    const timestamp = new Date().toISOString().slice(0, 10);
    return new File([buffer], `PurrDrop_${timestamp}.zip`, { type: 'application/zip' });
  }, []);

  // Handle multi-file selection
  const handleMultiFiles = useCallback(async (filesWithContext: { file: File, path: string }[], peer: Peer) => {
    if (filesWithContext.length === 0) return;

    // ไฟล์เดียว ส่งตรงๆ (เฉพาะถ้าไม่มี path ซับซ้อน หรือมีแค่ชื่อไฟล์)
    if (filesWithContext.length === 1 && filesWithContext[0].path === filesWithContext[0].file.name) {
      sendFile(peer, filesWithContext[0].file);
      return;
    }

    // หลายไฟล์ ให้ Zip รวม (Smart Folder: ใช้ path ที่เก็บมา สร้างโครงสร้าง folder ใน zip)
    toastRef.current?.show('กำลังบีบอัดไฟล์...', 'info');

    try {
      const zipFile = await createZipFile(filesWithContext);

      if (zipFile) {
        // Zip สำเร็จ ส่งไฟล์ Zip
        sendFile(peer, zipFile);
      } else {
        // Zip ไม่ผ่าน (เช่น ใหญ่เกิน 100MB) -> ส่งทีละไฟล์แบบรัวๆ (Queue)
        toastRef.current?.show(`ไฟล์ใหญ่เกิน 100MB จะทยอยส่งทีละไฟล์ (${filesWithContext.length} ไฟล์)`, 'warning');

        // Simple queue to prevent freezing
        for (const item of filesWithContext) {
          await sendFile(peer, item.file);
          // delay เล็กน้อย
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } catch (err) {
      console.error('ZIP error:', err);
      toastRef.current?.show('บีบอัดไฟล์ล้มเหลว', 'error');
    }
  }, [createZipFile, sendFile]);

  const handleSelectPeer = useCallback((peer: Peer) => {
    vibrate(15);
    selectedPeerRef.current = peer;
    fileInputRef.current?.click();
  }, [vibrate]);

  const handleDropFiles = useCallback((peer: Peer, files: { file: File, path: string }[]) => {
    vibrate([20, 50, 20]);
    // files already contains path context from PeerCard
    handleMultiFiles(files, peer);
  }, [handleMultiFiles, vibrate]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && selectedPeerRef.current) {
      const filesArr = Array.from(e.target.files);
      // For input selection, we don't have detailed path info, so use filename as path
      const filesWithContext = filesArr.map(f => ({ file: f, path: f.name }));

      handleMultiFiles(filesWithContext, selectedPeerRef.current);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleMultiFiles]);

  const handleAcceptFile = useCallback(() => {
    if (fileOffer) {
      // Add to history when receiving
      addToHistory({
        fileName: fileOffer.file.name,
        fileSize: fileOffer.file.size,
        peerName: fileOffer.from.name,
        direction: 'received',
        success: true,
      });
      setHistory(getHistory());
    }
    acceptFile();
    toastRef.current?.show('กำลังรับไฟล์...', 'info');
  }, [acceptFile, fileOffer]);

  const handleRejectFile = useCallback(() => {
    rejectFile();
    toastRef.current?.show('ปฏิเสธไฟล์แล้ว', 'warning');
  }, [rejectFile]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <>
      <BrowserWarning />
      <Clouds />
      <Confetti ref={confettiRef} />
      <Toast ref={toastRef} />

      <div id="toastContainer" />

      <div className="app">
        <Header
          muted={muted}
          isDark={isDark}
          hasPeers={peers.length > 0}
          onToggleMute={toggleMute}
          onToggleTheme={toggleTheme}
          onShowHistory={() => setShowHistoryModal(true)}
          onShowQR={() => setShowQRModal(true)}
        />

        <MyInfo
          peer={myPeer}
          connected={connected}
          connectionStatus={connectionStatus}
          onEditName={() => setShowNameModal(true)}
          onEditEmoji={() => setShowEmojiModal(true)}
        />

        <ModeSelector
          mode={discoveryMode}
          roomCode={roomCode}
          roomPassword={roomPassword}
          networkName={networkName}
          roomError={roomError}
          onChangeMode={setMode}
        />

        {peers.length === 0 ? (
          <EmptyState
            emoji={myPeer?.critter.emoji || '🐱'}
            onShowQR={() => setShowQRModal(true)}
            onShowHelp={() => setShowHelpModal(true)}
            onShowFeedback={() => setShowFeedbackModal(true)}
          />
        ) : (
          <PeersGrid
            peers={peers}
            newPeerIds={newPeerIds}
            onSelectPeer={handleSelectPeer}
            onDropFiles={handleDropFiles}
          />
        )}

        {transfer && (
          <TransferProgress
            fileName={transfer.fileName}
            fileSize={transfer.fileSize}
            progress={transfer.progress}
            status={transfer.status}
            emoji={myPeer?.critter.emoji || '🐱'}
            peerName={transfer.peerName}
            connectionType={transfer.connectionType}
            onCancel={cancelTransfer}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={handleFileSelect}
        />

        {/* Show fixed footer only when peers exist, or always on desktop */}
        <Footer onFeedback={() => setShowFeedbackModal(true)} hasPeers={peers.length > 0} />
      </div>

      {/* Modals */}
      {fileOffer && (
        <FileOfferModal
          show={true}
          from={fileOffer.from}
          file={fileOffer.file}
          onAccept={handleAcceptFile}
          onReject={handleRejectFile}
        />
      )}

      <NameModal
        show={showNameModal}
        currentName={myPeer?.name || ''}
        onSubmit={updateName}
        onClose={() => setShowNameModal(false)}
      />

      <EmojiModal
        show={showEmojiModal}
        currentEmoji={myPeer?.critter.emoji || '🐱'}
        onSelect={updateEmoji}
        onClose={() => setShowEmojiModal(false)}
      />

      <QRModal
        show={showQRModal}
        baseUrl={baseUrl}
        currentMode={discoveryMode}
        roomCode={roomCode}
        onClose={() => setShowQRModal(false)}
      />

      <HelpModal
        show={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      <HistoryModal
        show={showHistoryModal}
        history={history}
        onClose={() => setShowHistoryModal(false)}
        onClear={handleClearHistory}
      />

      <FeedbackModal
        show={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />
    </>
  );
}
