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
import {
  FileOfferModal,
  NameModal,
  EmojiModal,
  QRModal,
  HelpModal,
  SuccessModal,
  MultiFileModal,
} from '@/components/modals';
import { useSound } from '@/hooks/useSound';
import { usePeerConnection } from '@/hooks/usePeerConnection';
import { Peer } from '@/lib/critters';

export default function Home() {
  const {
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
  } = usePeerConnection();

  const { muted, toggle: toggleMute, play, vibrate } = useSound();

  const [showNameModal, setShowNameModal] = useState(false);
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showMultiFileModal, setShowMultiFileModal] = useState(false);
  const [successPeer, setSuccessPeer] = useState<Peer | null>(null);
  const [newPeerIds, setNewPeerIds] = useState<Set<string>>(new Set());
  const [url, setUrl] = useState('');
  const [pendingMultiFiles, setPendingMultiFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedPeerRef = useRef<Peer | null>(null);
  const confettiRef = useRef<ConfettiRef>(null);
  const toastRef = useRef<ToastRef>(null);
  const prevPeerIdsRef = useRef<Set<string>>(new Set());
  const fileQueueRef = useRef<File[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Track new peers for animation
  useEffect(() => {
    const currentIds = new Set(peers.map(p => p.id));
    const newIds = new Set<string>();
    
    currentIds.forEach(id => {
      if (!prevPeerIdsRef.current.has(id)) {
        newIds.add(id);
      }
    });

    if (newIds.size > 0) {
      setNewPeerIds(newIds);
      play('connect');
      setTimeout(() => setNewPeerIds(new Set()), 1000);
    }

    prevPeerIdsRef.current = currentIds;
  }, [peers, play]);

  // Get URL for QR
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(window.location.href);
    }
  }, []);

  // Handle transfer complete - process next file in queue
  useEffect(() => {
    if (transfer?.status === 'complete') {
      play('success');
      confettiRef.current?.burst();
      
      // Process next file in queue after a short delay
      setTimeout(() => {
        processNextInQueue();
      }, 500);
    }
  }, [transfer?.status, play]);

  // Handle transfer result (both send and receive)
  useEffect(() => {
    if (transferResult) {
      if (transferResult.success) {
        setSuccessPeer({
          id: '',
          name: transferResult.peerName,
          device: '',
          critter: { type: '', color: '', emoji: '🎉', os: 'unknown' as const },
        });
        setShowSuccess(true);
      }
      clearTransferResult();
    }
  }, [transferResult, clearTransferResult]);

  // Process file queue
  const processNextInQueue = useCallback(() => {
    if (fileQueueRef.current.length === 0) {
      isProcessingQueueRef.current = false;
      return;
    }
    
    if (!selectedPeerRef.current) {
      fileQueueRef.current = [];
      isProcessingQueueRef.current = false;
      return;
    }

    const nextFile = fileQueueRef.current.shift();
    if (nextFile) {
      sendFile(selectedPeerRef.current, nextFile);
    }
  }, [sendFile]);

  // Send files sequentially
  const sendFilesSequentially = useCallback((files: File[], peer: Peer) => {
    selectedPeerRef.current = peer;
    fileQueueRef.current = [...files];
    isProcessingQueueRef.current = true;
    
    // Start with first file
    const firstFile = fileQueueRef.current.shift();
    if (firstFile) {
      sendFile(peer, firstFile);
      play('whoosh');
    }
  }, [sendFile, play]);

  // Create ZIP file
  const createZipFile = useCallback(async (files: File[]): Promise<File> => {
    // Simple ZIP implementation
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    const centralDirectory: Uint8Array[] = [];
    let offset = 0;

    // CRC32 table
    const crc32Table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crc32Table[i] = c;
    }

    const crc32 = (data: Uint8Array): number => {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xFF];
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    };

    for (const file of files) {
      const fileData = new Uint8Array(await file.arrayBuffer());
      const fileName = encoder.encode(file.name);
      const crc = crc32(fileData);
      
      // Local file header
      const localHeader = new Uint8Array(30 + fileName.length);
      const view = new DataView(localHeader.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, fileData.length, true);
      view.setUint32(22, fileData.length, true);
      view.setUint16(26, fileName.length, true);
      view.setUint16(28, 0, true);
      localHeader.set(fileName, 30);

      // Central directory entry
      const cdEntry = new Uint8Array(46 + fileName.length);
      const cdView = new DataView(cdEntry.buffer);
      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 20, true);
      cdView.setUint16(8, 0, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, 0, true);
      cdView.setUint16(14, 0, true);
      cdView.setUint32(16, crc, true);
      cdView.setUint32(20, fileData.length, true);
      cdView.setUint32(24, fileData.length, true);
      cdView.setUint16(28, fileName.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, offset, true);
      cdEntry.set(fileName, 46);

      parts.push(localHeader, fileData);
      centralDirectory.push(cdEntry);
      offset += localHeader.length + fileData.length;
    }

    const cdSize = centralDirectory.reduce((sum, e) => sum + e.length, 0);
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, files.length, true);
    eocdView.setUint16(10, files.length, true);
    eocdView.setUint32(12, cdSize, true);
    eocdView.setUint32(16, offset, true);
    eocdView.setUint16(20, 0, true);

    const blob = new Blob([...parts, ...centralDirectory, eocd], { type: 'application/zip' });
    const timestamp = new Date().toISOString().slice(0, 10);
    return new File([blob], `PurrDrop_${timestamp}.zip`, { type: 'application/zip' });
  }, []);

  // Handle multi-file selection
  const handleMultiFiles = useCallback(async (files: File[], peer: Peer) => {
    if (files.length < 2) {
      // Single file - send directly
      sendFile(peer, files[0]);
      play('whoosh');
      return;
    }

    // Multiple files - show options
    selectedPeerRef.current = peer;
    setPendingMultiFiles(files);
    setShowMultiFileModal(true);
  }, [sendFile, play]);

  const handleMultiFileZip = useCallback(async () => {
    setShowMultiFileModal(false);
    if (!selectedPeerRef.current || pendingMultiFiles.length === 0) return;

    toastRef.current?.show('กำลังสร้างไฟล์ ZIP...', 'info');
    
    try {
      const zipFile = await createZipFile(pendingMultiFiles);
      sendFile(selectedPeerRef.current, zipFile);
      play('whoosh');
    } catch {
      toastRef.current?.show('สร้าง ZIP ไม่สำเร็จ ส่งทีละไฟล์แทน', 'warning');
      sendFilesSequentially(pendingMultiFiles, selectedPeerRef.current);
    }
    
    setPendingMultiFiles([]);
  }, [pendingMultiFiles, createZipFile, sendFile, sendFilesSequentially, play]);

  const handleMultiFileSeparate = useCallback(() => {
    setShowMultiFileModal(false);
    if (!selectedPeerRef.current || pendingMultiFiles.length === 0) return;
    
    sendFilesSequentially(pendingMultiFiles, selectedPeerRef.current);
    setPendingMultiFiles([]);
  }, [pendingMultiFiles, sendFilesSequentially]);

  const handleMultiFileCancel = useCallback(() => {
    setShowMultiFileModal(false);
    setPendingMultiFiles([]);
  }, []);

  const handleSelectPeer = useCallback((peer: Peer) => {
    vibrate(15);
    selectedPeerRef.current = peer;
    fileInputRef.current?.click();
  }, [vibrate]);

  const handleDropFiles = useCallback((peer: Peer, files: FileList) => {
    vibrate([20, 50, 20]);
    const fileArray = Array.from(files);
    handleMultiFiles(fileArray, peer);
  }, [handleMultiFiles, vibrate]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedPeerRef.current) return;
    
    const fileArray = Array.from(files);
    handleMultiFiles(fileArray, selectedPeerRef.current);
    e.target.value = '';
  }, [handleMultiFiles]);

  const handleAcceptFile = useCallback(() => {
    acceptFile();
    toastRef.current?.show('กำลังรับไฟล์...', 'info');
  }, [acceptFile]);

  const handleRejectFile = useCallback(() => {
    rejectFile();
    toastRef.current?.show('ปฏิเสธไฟล์แล้ว', 'warning');
  }, [rejectFile]);

  const totalPendingSize = pendingMultiFiles.reduce((sum, f) => sum + f.size, 0);

  return (
    <>
      <Clouds />
      <Confetti ref={confettiRef} />
      <Toast ref={toastRef} />

      <div id="toastContainer" />

      <div className="app">
        <Header muted={muted} onToggleMute={toggleMute} />

        <MyInfo
          peer={myPeer}
          connected={connected}
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
            progress={transfer.progress}
            status={transfer.status}
            emoji={myPeer?.critter.emoji || '🐱'}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={handleFileSelect}
        />
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

      <MultiFileModal
        show={showMultiFileModal}
        fileCount={pendingMultiFiles.length}
        totalSize={totalPendingSize}
        onZip={handleMultiFileZip}
        onSeparate={handleMultiFileSeparate}
        onCancel={handleMultiFileCancel}
      />

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

      <SuccessModal
        show={showSuccess}
        myEmoji={myPeer?.critter.emoji || '🐱'}
        myName={myPeer?.name || 'ฉัน'}
        peerEmoji={successPeer?.critter.emoji || '🐰'}
        peerName={successPeer?.name || 'เพื่อน'}
        onClose={() => setShowSuccess(false)}
      />
    </>
  );
}
