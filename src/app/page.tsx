'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Clouds } from '@/components/Clouds';
import { Header } from '@/components/Header';
import { MyInfo } from '@/components/MyInfo';
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
  const [url, setUrl] = useState('');
  const [history, setHistory] = useState<TransferRecord[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedPeerRef = useRef<Peer | null>(null);
  const confettiRef = useRef<ConfettiRef>(null);
  const toastRef = useRef<ToastRef>(null);
  const prevPeerIdsRef = useRef<Set<string>>(new Set());

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory());
  }, []);

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

  // Get URL for QR + Register Service Worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(window.location.href);
      
      // Register service worker for PWA
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
      }
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

  // Create ZIP file
  const createZipFile = useCallback(async (files: File[]): Promise<File> => {
    let totalSize = 22;
    const fileInfos: { name: Uint8Array; data: Uint8Array; crc: number }[] = [];
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

    for (const file of files) {
      const data = new Uint8Array(await file.arrayBuffer());
      const name = encoder.encode(file.name);
      const crc = calcCrc32(data);
      fileInfos.push({ name, data, crc });
      totalSize += 30 + name.length + data.length;
      totalSize += 46 + name.length;
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let pos = 0;
    let cdStart = 0;

    for (const { name, data, crc } of fileInfos) {
      view.setUint32(pos, 0x04034b50, true); pos += 4;
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
      bytes.set(name, pos); pos += name.length;
      bytes.set(data, pos); pos += data.length;
    }

    cdStart = pos;

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
  const handleMultiFiles = useCallback(async (files: File[], peer: Peer) => {
    if (files.length === 0) return;
    
    if (files.length === 1) {
      sendFile(peer, files[0]);
      play('whoosh');
      return;
    }

    toastRef.current?.show(`กำลังรวม ${files.length} ไฟล์เป็น ZIP...`, 'info');
    
    try {
      const zipFile = await createZipFile(files);
      sendFile(peer, zipFile);
      play('whoosh');
      toastRef.current?.show(`ส่ง ${zipFile.name} แล้ว`, 'success');
    } catch {
      toastRef.current?.show('สร้าง ZIP ไม่สำเร็จ ส่งไฟล์แรกแทน', 'warning');
      sendFile(peer, files[0]);
      play('whoosh');
    }
  }, [sendFile, play, createZipFile]);

  const handleSelectPeer = useCallback((peer: Peer) => {
    vibrate(15);
    selectedPeerRef.current = peer;
    fileInputRef.current?.click();
  }, [vibrate]);

  const handleDropFiles = useCallback((peer: Peer, files: File[]) => {
    vibrate([20, 50, 20]);
    handleMultiFiles(files, peer);
  }, [handleMultiFiles, vibrate]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedPeerRef.current) return;
    
    const fileArray = Array.from(files);
    handleMultiFiles(fileArray, selectedPeerRef.current);
    e.target.value = '';
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

        {peers.length === 0 ? (
          <EmptyState
            emoji={myPeer?.critter.emoji || '🐱'}
            onShowQR={() => setShowQRModal(true)}
            onShowHelp={() => setShowHelpModal(true)}
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

        <Footer onFeedback={() => setShowFeedbackModal(true)} />
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
        url={url}
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
