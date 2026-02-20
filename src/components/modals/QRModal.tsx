'use client';

import { useEffect, useRef, useState } from 'react';
import { DiscoveryMode } from '@/hooks/usePeerConnection';

// Lucide Icons
const EarthIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/>
    <path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/>
    <path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/>
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

const WifiIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h.01"/>
    <path d="M2 8.82a15 15 0 0 1 20 0"/>
    <path d="M5 12.859a10 10 0 0 1 14 0"/>
    <path d="M8.5 16.429a5 5 0 0 1 7 0"/>
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

interface QRModalProps {
  show: boolean;
  baseUrl: string;
  currentMode: DiscoveryMode;
  roomCode: string | null;
  onClose: () => void;
}

const modeLabels: Record<DiscoveryMode, { icon: React.ReactNode; label: string }> = {
  public: { icon: <EarthIcon />, label: 'สาธารณะ' },
  wifi: { icon: <WifiIcon />, label: 'WiFi เดียวกัน' },
  private: { icon: <LockIcon />, label: 'ส่วนตัว' },
};

export function QRModal({ show, baseUrl, currentMode, roomCode, onClose }: QRModalProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Build URL with mode parameter
  const getQRUrl = () => {
    if (!baseUrl) return '';
    
    try {
      const url = new URL(baseUrl);
      
      if (currentMode === 'wifi') {
        url.searchParams.set('mode', 'wifi');
      } else if (currentMode === 'private' && roomCode) {
        url.searchParams.set('mode', 'private');
        url.searchParams.set('room', roomCode);
      }
      // public mode = no params needed
      
      return url.toString();
    } catch {
      return baseUrl;
    }
  };

  const qrUrl = getQRUrl();

  useEffect(() => {
    if (show && canvasRef.current && qrUrl) {
      import('qrcode').then(QRCode => {
        const canvas = document.createElement('canvas');
        QRCode.toCanvas(canvas, qrUrl, { width: 200, margin: 2 }, (err) => {
          if (!err && canvasRef.current) {
            canvasRef.current.innerHTML = '';
            canvasRef.current.appendChild(canvas);
          }
        });
      }).catch(() => {
        if (canvasRef.current) {
          canvasRef.current.innerHTML = `<div class="qr-placeholder">${qrUrl}</div>`;
        }
      });
    }
  }, [show, qrUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = qrUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!show || !qrUrl) return null;

  const modeInfo = modeLabels[currentMode];

  return (
    <div className="modal show">
      <div className="modal-content modal-qr">
        <div className="modal-critter qr-mode-icon">{modeInfo.icon}</div>
        <div className="modal-title">สแกนเพื่อเชื่อมต่อ</div>
        <div className="qr-mode-badge">
          {modeInfo.icon} {modeInfo.label}
          {currentMode === 'private' && roomCode && (
            <span className="qr-room-code">ห้อง {roomCode}</span>
          )}
        </div>
        <div className="qr-container" ref={canvasRef}>
          <div className="qr-placeholder">กำลังโหลด...</div>
        </div>
        <div className="qr-url-row">
          <div className="modal-url">{qrUrl}</div>
          <button className="qr-copy-btn" onClick={handleCopy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
        <button className="btn btn-close-modal" onClick={onClose}>ปิด</button>
      </div>
    </div>
  );
}
