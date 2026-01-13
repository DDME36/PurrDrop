'use client';

import { useEffect, useRef, useState } from 'react';
import { DiscoveryMode } from '@/hooks/usePeerConnection';

interface QRModalProps {
  show: boolean;
  baseUrl: string;
  currentMode: DiscoveryMode;
  roomCode: string | null;
  onClose: () => void;
}

const modeLabels: Record<DiscoveryMode, { icon: string; label: string }> = {
  public: { icon: '🌐', label: 'สาธารณะ' },
  wifi: { icon: '📶', label: 'WiFi เดียวกัน' },
  private: { icon: '🔐', label: 'ส่วนตัว' },
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
        <div className="modal-critter">{modeInfo.icon}</div>
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
            {copied ? '✓' : '📋'}
          </button>
        </div>
        <button className="btn btn-close-modal" onClick={onClose}>ปิด</button>
      </div>
    </div>
  );
}
