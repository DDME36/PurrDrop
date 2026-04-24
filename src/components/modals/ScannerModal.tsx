'use client';

import { useEffect, useRef, useState } from 'react';

// Icons
const XIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);

const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>
  </svg>
);

interface ScannerModalProps {
  show: boolean;
  onScan: (code: string) => void;
  onClose: () => void;
}

export function ScannerModal({ show, onScan, onClose }: ScannerModalProps) {
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!show) return;

    // Load library from CDN
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode';
    script.async = true;
    script.onload = () => {
      setIsLoaded(true);
      startScanner();
    };
    document.body.appendChild(script);

    return () => {
      stopScanner();
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [show]);

  const startScanner = () => {
    try {
      const Html5QrcodeScanner = (window as any).Html5Qrcode;
      if (!Html5QrcodeScanner) return;

      scannerRef.current = new Html5QrcodeScanner("qr-reader");
      
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      scannerRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText: string) => {
          // Success
          handleScanSuccess(decodedText);
        },
        (errorMessage: string) => {
          // Ignore frequent noise errors
        }
      ).catch((err: any) => {
        console.error("Scanner error:", err);
        setError("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง");
      });
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการโหลดกล้อง");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleScanSuccess = (text: string) => {
    // Expected format: https://purrdrop.com/?mode=private&room=ABCDE
    try {
      const url = new URL(text);
      const room = url.searchParams.get('room');
      if (room) {
        onScan(room);
        stopScanner();
        onClose();
      } else {
        // Just raw code
        if (text.length === 5) {
          onScan(text);
          stopScanner();
          onClose();
        }
      }
    } catch (e) {
      // Not a URL, check if it's a 5-digit code
      if (text.trim().length === 5) {
        onScan(text.trim());
        stopScanner();
        onClose();
      }
    }
  };

  if (!show) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-scanner" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title"><CameraIcon /> สแกน QR Code</h3>
            <p className="modal-subtitle">สแกนเพื่อเข้าห้องอัตโนมัติ</p>
          </div>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="scanner-container">
          <div id="qr-reader" style={{ width: '100%' }}></div>
          {!isLoaded && <div className="scanner-loading">กำลังโหลดระบบสแกน...</div>}
          {error && <div className="scanner-error">{error}</div>}
        </div>

        <div className="scanner-footer">
          <p>วาง QR Code ให้อยู่ในกรอบเพื่อเริ่มสแกน</p>
        </div>
      </div>
    </div>
  );
}
