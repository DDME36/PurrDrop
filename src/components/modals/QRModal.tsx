'use client';

import { useEffect, useRef } from 'react';

interface QRModalProps {
  show: boolean;
  url: string;
  onClose: () => void;
}

export function QRModal({ show, url, onClose }: QRModalProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && canvasRef.current && url) {
      // Dynamic import QRCode library
      import('qrcode').then(QRCode => {
        const canvas = document.createElement('canvas');
        QRCode.toCanvas(canvas, url, { width: 200, margin: 2 }, (err) => {
          if (!err && canvasRef.current) {
            canvasRef.current.innerHTML = '';
            canvasRef.current.appendChild(canvas);
          }
        });
      }).catch(() => {
        // Fallback: show URL
        if (canvasRef.current) {
          canvasRef.current.innerHTML = `<div class="qr-placeholder">${url}</div>`;
        }
      });
    }
  }, [show, url]);

  if (!show) return null;

  return (
    <div className="modal show">
      <div className="modal-content modal-qr">
        <div className="modal-critter">🐱</div>
        <div className="modal-title">สแกนเพื่อเชื่อมต่อ</div>
        <div className="qr-container" ref={canvasRef}>
          <div className="qr-placeholder">กำลังโหลด...</div>
        </div>
        <div className="modal-url">{url}</div>
        <button className="btn btn-close-modal" onClick={onClose}>ปิด</button>
      </div>
    </div>
  );
}
