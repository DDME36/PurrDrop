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
  const [successPeer, setSuccessPeer] = useState<Peer | null>(null);
  const [newPeerIds, setNewPeerIds] = useState<Set<string>>(new Set());
  const [url, setUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedPeerRef = useRef<Peer | null>(null);
  const confettiRef = useRef<ConfettiRef>(null);
  const toastRef = useRef<ToastRef>(null);
  const prevPeerIdsRef = useRef<Set<string>>(new Set());

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

  // Handle transfer complete
  useEffect(() => {
    if (transfer?.status === 'complete') {
      play('success');
      confettiRef.current?.burst();
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

  // Create ZIP file - simplified version
  const createZipFile = useCallback(async (files: File[]): Promise<File> => {
    // Calculate total size for pre-allocation
    let totalSize = 22; // EOCD size
    const fileInfos: { name: Uint8Array; data: Uint8Array; crc: number }[] = [];
    const encoder = new TextEncoder();
    
    // CRC32 calculation
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

    // Read all files
    for (const file of files) {
      const data = new Uint8Array(await file.arrayBuffer());
      const name = encoder.encode(file.name);
      const crc = calcCrc32(data);
      fileInfos.push({ name, data, crc });
      totalSize += 30 + name.length + data.length; // Local header + data
      totalSize += 46 + name.length; // Central directory entry
    }

    // Create single buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let pos = 0;
    let cdStart = 0;

    // Write local file headers and data
    for (const { name, data, crc } of fileInfos) {
      // Local file header signature
      view.setUint32(pos, 0x04034b50, true); pos += 4;
      view.setUint16(pos, 20, true); pos += 2; // version needed
      view.setUint16(pos, 0, true); pos += 2; // flags
      view.setUint16(pos, 0, true); pos += 2; // compression (store)
      view.setUint16(pos, 0, true); pos += 2; // mod time
      view.setUint16(pos, 0, true); pos += 2; // mod date
      view.setUint32(pos, crc, true); pos += 4; // crc32
      view.setUint32(pos, data.length, true); pos += 4; // compressed size
      view.setUint32(pos, data.length, true); pos += 4; // uncompressed size
      view.setUint16(pos, name.length, true); pos += 2; // filename length
      view.setUint16(pos, 0, true); pos += 2; // extra field length
      bytes.set(name, pos); pos += name.length; // filename
      bytes.set(data, pos); pos += data.length; // file data
    }

    cdStart = pos;

    // Write central directory
    let localOffset = 0;
    for (const { name, data, crc } of fileInfos) {
      view.setUint32(pos, 0x02014b50, true); pos += 4; // signature
      view.setUint16(pos, 20, true); pos += 2; // version made by
      view.setUint16(pos, 20, true); pos += 2; // version needed
      view.setUint16(pos, 0, true); pos += 2; // flags
      view.setUint16(pos, 0, true); pos += 2; // compression
      view.setUint16(pos, 0, true); pos += 2; // mod time
      view.setUint16(pos, 0, true); pos += 2; // mod date
      view.setUint32(pos, crc, true); pos += 4; // crc32
      view.setUint32(pos, data.length, true); pos += 4; // compressed size
      view.setUint32(pos, data.length, true); pos += 4; // uncompressed size
      view.setUint16(pos, name.length, true); pos += 2; // filename length
      view.setUint16(pos, 0, true); pos += 2; // extra field length
      view.setUint16(pos, 0, true); pos += 2; // comment length
      view.setUint16(pos, 0, true); pos += 2; // disk number
      view.setUint16(pos, 0, true); pos += 2; // internal attrs
      view.setUint32(pos, 0, true); pos += 4; // external attrs
      view.setUint32(pos, localOffset, true); pos += 4; // local header offset
      bytes.set(name, pos); pos += name.length; // filename
      localOffset += 30 + name.length + data.length;
    }

    const cdSize = pos - cdStart;

    // Write end of central directory
    view.setUint32(pos, 0x06054b50, true); pos += 4; // signature
    view.setUint16(pos, 0, true); pos += 2; // disk number
    view.setUint16(pos, 0, true); pos += 2; // cd disk number
    view.setUint16(pos, fileInfos.length, true); pos += 2; // entries on disk
    view.setUint16(pos, fileInfos.length, true); pos += 2; // total entries
    view.setUint32(pos, cdSize, true); pos += 4; // cd size
    view.setUint32(pos, cdStart, true); pos += 4; // cd offset
    view.setUint16(pos, 0, true); // comment length

    const timestamp = new Date().toISOString().slice(0, 10);
    return new File([buffer], `PurrDrop_${timestamp}.zip`, { type: 'application/zip' });
  }, []);

  // Handle multi-file selection - auto ZIP if multiple files (v2)
  const handleMultiFiles = useCallback(async (files: File[], peer: Peer) => {
    console.log('[v2] handleMultiFiles called with', files.length, 'files');
    
    if (files.length === 0) return;
    
    if (files.length === 1) {
      // Single file - send directly
      console.log('[v2] Single file, sending directly');
      sendFile(peer, files[0]);
      play('whoosh');
      return;
    }

    // Multiple files - auto create ZIP (simpler UX)
    console.log('[v2] Multiple files detected, creating ZIP for', files.length, 'files');
    toastRef.current?.show(`กำลังรวม ${files.length} ไฟล์เป็น ZIP...`, 'info');
    
    try {
      const zipFile = await createZipFile(files);
      console.log('[v2] ZIP created successfully:', zipFile.name, 'size:', zipFile.size);
      sendFile(peer, zipFile);
      play('whoosh');
      toastRef.current?.show(`ส่ง ${zipFile.name} แล้ว`, 'success');
    } catch (err) {
      console.error('[v2] ZIP creation failed:', err);
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
    acceptFile();
    toastRef.current?.show('กำลังรับไฟล์...', 'info');
  }, [acceptFile]);

  const handleRejectFile = useCallback(() => {
    rejectFile();
    toastRef.current?.show('ปฏิเสธไฟล์แล้ว', 'warning');
  }, [rejectFile]);

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
            fileSize={transfer.fileSize}
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
