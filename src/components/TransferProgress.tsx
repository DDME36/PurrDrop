'use client';

import { useEffect, useState, useRef } from 'react';

interface TransferProgressProps {
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'sending' | 'receiving' | 'complete' | 'error';
  emoji: string;
  peerName: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--:--';
  if (seconds < 60) return `${Math.ceil(seconds)} วิ`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')} นาที`;
}

export function TransferProgress({ fileName, fileSize, progress, status, emoji, peerName, onComplete, onCancel }: TransferProgressProps) {
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastUpdateRef = useRef({ time: Date.now(), bytes: 0 });
  const speedHistoryRef = useRef<number[]>([]);
  const minDisplayTimeRef = useRef<number | null>(null);

  // Track minimum display time
  useEffect(() => {
    if (progress === 0 && !minDisplayTimeRef.current) {
      minDisplayTimeRef.current = Date.now();
    }
  }, [progress]);

  // Smooth progress animation
  useEffect(() => {
    const animate = () => {
      setDisplayProgress(prev => {
        const diff = progress - prev;
        if (Math.abs(diff) < 0.5) return progress;
        return prev + diff * 0.15;
      });
    };
    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [progress]);

  // Handle completion with minimum display time
  useEffect(() => {
    if (status === 'complete' && !showSuccess && !isClosing) {
      const startTime = minDisplayTimeRef.current || Date.now();
      const elapsed = Date.now() - startTime;
      const minTime = 4000; // Minimum 4 seconds display for mobile Safari
      const remaining = Math.max(0, minTime - elapsed);

      // First ensure progress bar fills to 100%
      setDisplayProgress(100);

      // Then show success after minimum time
      const successTimer = setTimeout(() => {
        setShowSuccess(true);
      }, remaining + 500);

      return () => clearTimeout(successTimer);
    }
  }, [status, showSuccess, isClosing]);

  // Auto close after showing success
  useEffect(() => {
    if (showSuccess && !isClosing) {
      const closeTimer = setTimeout(() => {
        setIsClosing(true);
        
        // Wait for close animation to finish
        setTimeout(() => {
          setIsVisible(false);
          onComplete?.();
        }, 400);
      }, 2000);

      return () => clearTimeout(closeTimer);
    }
  }, [showSuccess, isClosing, onComplete]);

  // Calculate speed and ETA
  useEffect(() => {
    const now = Date.now();
    const currentBytes = (progress / 100) * fileSize;
    const timeDiff = (now - lastUpdateRef.current.time) / 1000;
    const bytesDiff = currentBytes - lastUpdateRef.current.bytes;

    if (timeDiff > 0.1 && bytesDiff > 0) {
      const currentSpeed = bytesDiff / timeDiff;
      
      speedHistoryRef.current.push(currentSpeed);
      if (speedHistoryRef.current.length > 5) {
        speedHistoryRef.current.shift();
      }
      const avgSpeed = speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;
      
      setSpeed(avgSpeed);
      
      const remaining = fileSize - currentBytes;
      setEta(remaining / avgSpeed);
      
      lastUpdateRef.current = { time: now, bytes: currentBytes };
    }
  }, [progress, fileSize]);

  // Reset on new transfer
  useEffect(() => {
    if (progress === 0) {
      lastUpdateRef.current = { time: Date.now(), bytes: 0 };
      speedHistoryRef.current = [];
      minDisplayTimeRef.current = Date.now();
      setSpeed(0);
      setEta(0);
      setShowSuccess(false);
      setIsClosing(false);
      setIsVisible(true);
    }
  }, [progress]);

  if (!isVisible) return null;

  const statusConfig = {
    sending: { text: 'กำลังส่ง', icon: 'upload', color: 'var(--accent-mint)' },
    receiving: { text: 'กำลังรับ', icon: 'download', color: 'var(--accent-peach)' },
    complete: { text: 'เสร็จแล้ว!', icon: 'check', color: 'var(--accent-mint)' },
    error: { text: 'ผิดพลาด', icon: 'x', color: '#ff6b6b' },
  };

  const config = statusConfig[status];
  const isActive = status === 'sending' || status === 'receiving';

  // Status icons as SVG
  const StatusIcon = () => {
    if (config.icon === 'upload') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 17V3"/>
          <path d="m6 8 6-6 6 6"/>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        </svg>
      );
    }
    if (config.icon === 'download') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15V3"/>
          <path d="m7 10 5 5 5-5"/>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        </svg>
      );
    }
    if (config.icon === 'check') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18"/>
        <path d="m6 6 12 12"/>
      </svg>
    );
  };

  return (
    <div className={`transfer-overlay ${showSuccess ? 'success-state' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className={`transfer-card ${showSuccess ? 'card-success' : ''} ${isClosing ? 'card-closing' : ''}`}>
        {/* Animated background */}
        <div className="transfer-bg">
          <div className="transfer-wave" style={{ animationDuration: isActive ? '2s' : '0s' }} />
          <div className="transfer-wave wave-2" style={{ animationDuration: isActive ? '2.5s' : '0s' }} />
        </div>

        {/* Content */}
        <div className="transfer-content">
          {showSuccess ? (
            // Success State - morphed from progress
            <>
              <div className="transfer-success-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div className="transfer-success-text">
                {status === 'complete' ? 'ส่งสำเร็จ!' : 'เสร็จแล้ว!'}
              </div>
              <div className="transfer-success-file">{fileName}</div>
            </>
          ) : (
            // Progress State
            <>
              <div className={`transfer-emoji ${isActive ? 'pulse' : ''}`}>
                {emoji}
              </div>
              <div className="transfer-peer-name">{peerName}</div>

              <div className="transfer-status-row">
                <span className="transfer-status-icon"><StatusIcon /></span>
                <span className="transfer-status-text" style={{ color: config.color }}>{config.text}</span>
              </div>

              <div className="transfer-filename">{fileName}</div>

              <div className="transfer-progress-container">
                <div className="transfer-progress-track">
                  <div 
                    className="transfer-progress-fill"
                    style={{ 
                      width: `${displayProgress}%`,
                      background: `linear-gradient(90deg, ${config.color}, var(--accent-pink))`,
                    }}
                  />
                  <div className="transfer-progress-percent">{Math.round(displayProgress)}%</div>
                  {isActive && (
                    <div 
                      className="transfer-progress-glow"
                      style={{ left: `${displayProgress}%` }}
                    />
                  )}
                </div>
              </div>

              {isActive && fileSize > 0 && (
                <div className="transfer-stats">
                  <div className="transfer-stat">
                    <span className="stat-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
                        <path d="m19 9-5 5-4-4-3 3"/>
                      </svg>
                    </span>
                    <span>{formatBytes((progress / 100) * fileSize)} / {formatBytes(fileSize)}</span>
                  </div>
                  <div className="transfer-stat">
                    <span className="stat-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                    </span>
                    <span>{formatBytes(speed)}/s</span>
                  </div>
                  <div className="transfer-stat">
                    <span className="stat-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </span>
                    <span>{formatTime(eta)}</span>
                  </div>
                </div>
              )}

              {isActive && onCancel && (
                <button className="transfer-cancel-btn" onClick={onCancel}>
                  ยกเลิก
                </button>
              )}

              {status === 'error' && (
                <div className="transfer-error">
                  <p>การเชื่อมต่อล้มเหลว</p>
                  <button className="transfer-cancel-btn" onClick={onCancel}>
                    ปิด
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
