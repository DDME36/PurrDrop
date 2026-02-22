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
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  FileOfferModal,
  NameModal,
  EmojiModal,
  QRModal,
  HelpModal,
  HistoryModal,
  FeedbackModal,
  TextShareModal,
} from '@/components/modals';
import { useSound } from '@/hooks/useSound';
import { usePeerConnection } from '@/hooks/usePeerConnection';
import { useTheme } from '@/hooks/useTheme';
import { useNotification } from '@/hooks/useNotification';
import { Peer } from '@/lib/critters';
import { createZipFile, FileWithContext } from '@/lib/compression';
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
    textMessage,
    transfer,
    transferResult,
    sendFile,
    sendText,
    acceptFile,
    rejectFile,
    updateName,
    updateEmoji,
    clearTransferResult,
    clearTextMessage,
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
  const [showTextShareModal, setShowTextShareModal] = useState(false);
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

  // Handle incoming text message
  useEffect(() => {
    if (textMessage) {
      play('success');
      
      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('ข้อความใหม่จาก ' + textMessage.from.name, {
          body: textMessage.text.slice(0, 100) + (textMessage.text.length > 100 ? '...' : ''),
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        });
      }
      
      toastRef.current?.show(`ข้อความจาก ${textMessage.from.name}: ${textMessage.text.slice(0, 50)}${textMessage.text.length > 50 ? '...' : ''}`, 'success');
      
      // Add to history with text content
      addToHistory({
        fileName: 'ข้อความ/ลิงก์',
        fileSize: new Blob([textMessage.text]).size,
        peerName: textMessage.from.name,
        direction: 'received',
        success: true,
        type: 'text',
        textContent: textMessage.text,
      });
      setHistory(getHistory());
      
      clearTextMessage();
    }
  }, [textMessage, play, clearTextMessage]);

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

  // Handle multi-file selection
  const handleMultiFiles = useCallback(async (filesWithContext: FileWithContext[], peer: Peer) => {
    if (filesWithContext.length === 0) return;

    // Single file - send directly (only if no complex path or just filename)
    if (filesWithContext.length === 1 && filesWithContext[0].path === filesWithContext[0].file.name) {
      sendFile(peer, filesWithContext[0].file);
      return;
    }

    // Multiple files - create ZIP (Smart Folder: use preserved paths for folder structure)
    toastRef.current?.show('กำลังบีบอัดไฟล์...', 'info');

    try {
      const zipFile = await createZipFile(filesWithContext);

      if (zipFile) {
        // ZIP successful - send ZIP file
        sendFile(peer, zipFile);
      } else {
        // ZIP failed (e.g., > 100MB) -> send files one by one (Queue)
        toastRef.current?.show(`ไฟล์ใหญ่เกิน 100MB จะทยอยส่งทีละไฟล์ (${filesWithContext.length} ไฟล์)`, 'warning');

        // Simple queue to prevent freezing
        for (const item of filesWithContext) {
          await sendFile(peer, item.file);
          // Small delay
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } catch (err) {
      console.error('ZIP error:', err);
      toastRef.current?.show('บีบอัดไฟล์ล้มเหลว', 'error');
    }
  }, [sendFile]);

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
      <OfflineBanner />
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

      {/* Floating Action Button for Text Share */}
      {peers.length > 0 && (
        <div className="fab-container">
          <button 
            className="fab-btn" 
            onClick={() => setShowTextShareModal(true)}
            title="ส่งข้อความ/ลิงก์"
            aria-label="ส่งข้อความหรือลิงก์"
          >
            <svg className="fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
              <path d="M10 9H8"/>
              <path d="M16 13H8"/>
              <path d="M16 17H8"/>
            </svg>
          </button>
        </div>
      )}

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

      <TextShareModal
        show={showTextShareModal}
        peers={peers}
        onSend={(peer, text) => {
          sendText(peer.id, text, peer);
          // Add sent text to history
          addToHistory({
            fileName: 'ข้อความ/ลิงก์',
            fileSize: new Blob([text]).size,
            peerName: peer.name,
            direction: 'sent',
            success: true,
            type: 'text',
            textContent: text,
          });
          setHistory(getHistory());
          toastRef.current?.show(`ส่งข้อความให้ ${peer.name} แล้ว`, 'success');
        }}
        onClose={() => setShowTextShareModal(false)}
      />
    </>
  );
}
