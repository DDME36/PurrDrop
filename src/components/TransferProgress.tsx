'use client';

import { useEffect, useState, useRef } from 'react';

interface TransferProgressProps {
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'connecting' | 'sending' | 'receiving' | 'complete' | 'saving' | 'error';
  emoji: string;
  peerName: string;
  connectionType?: 'direct' | 'stun' | 'relay';
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

export function TransferProgress({ fileName, fileSize, progress, status, emoji, peerName, connectionType, onComplete, onCancel }: TransferProgressProps) {
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const lastUpdateRef = useRef({ time: 0, bytes: 0 });
  const speedHistoryRef = useRef<number[]>([]);
  const minDisplayTimeRef = useRef<number | null>(null);

  // Initialize time properly once mounted to avoid pure render issues
  useEffect(() => {
    if (lastUpdateRef.current.time === 0) {
      lastUpdateRef.current.time = Date.now();
    }
  }, []);

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
      // Auto-expand when complete
      setIsMinimized(false);

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
      setIsMinimized(false);
    }
  }, [progress]);

  if (!isVisible) return null;

  const statusConfig = {
    pending: { text: 'รอการยืนยัน...', icon: 'waiting', color: 'var(--accent-lavender)' },
    connecting: { text: 'กำลังเชื่อมต่อ...', icon: 'waiting', color: 'var(--accent-lavender)' },
    sending: { text: 'กำลังส่ง', icon: 'upload', color: 'var(--accent-mint)' },
    receiving: { text: 'กำลังรับ', icon: 'download', color: 'var(--accent-peach)' },
    saving: { text: 'รอบันทึกไฟล์...', icon: 'save', color: 'var(--accent-lavender)' },
    complete: { text: 'เสร็จแล้ว!', icon: 'check', color: 'var(--accent-mint)' },
    error: { text: 'ผิดพลาด', icon: 'x', color: '#ff6b6b' },
  };

  const config = statusConfig[status];
  const isActive = status === 'pending' || status === 'connecting' || status === 'sending' || status === 'receiving' || status === 'saving';

  let iconSvg = null;
  if (config.icon === 'waiting') {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-waiting">
        <path d="M5 22h14" />
        <path d="M5 2h14" />
        <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
        <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
      </svg>
    );
  } else if (config.icon === 'upload') {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 17V3" />
        <path d="m6 8 6-6 6 6" />
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      </svg>
    );
  } else if (config.icon === 'download') {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15V3" />
        <path d="m7 10 5 5 5-5" />
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      </svg>
    );
  } else if (config.icon === 'save') {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-waiting">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    );
  } else if (config.icon === 'check') {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  } else {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={config.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    );
  }

  // ── Minimized floating bar ──
  if (isMinimized) {
    return (
      <div
        className={`transfer-minimized-bar ${isClosing ? 'closing' : ''}`}
        onClick={() => setIsMinimized(false)}
        role="button"
        tabIndex={0}
        aria-label="ขยายรายละเอียดการถ่ายโอน"
      >
        <div className="tmb-emoji">{emoji}</div>

        <div className="tmb-info">
          <div className="tmb-top-row">
            <span className="tmb-status" style={{ color: config.color }}>
              {iconSvg}
              {config.text}
            </span>
            <span className="tmb-percent">{displayProgress.toFixed(0)}%</span>
          </div>
          <div className="tmb-filename">{fileName}</div>
          <div className="tmb-progress-track">
            <div
              className="tmb-progress-fill"
              style={{
                width: `${displayProgress}%`,
                background: `linear-gradient(90deg, ${config.color}, var(--accent-pink))`,
              }}
            />
          </div>
          {isActive && speed > 0 && (
            <div className="tmb-stats">
              <span>{formatBytes(speed)}/s</span>
              <span>·</span>
              <span>{formatTime(eta)}</span>
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <div className="tmb-expand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 15-6-6-6 6" />
          </svg>
        </div>
      </div>
    );
  }

  // ── Expanded full overlay ──
  return (
    <div className={`transfer-overlay ${showSuccess ? 'success-state' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className={`transfer-card ${showSuccess ? 'card-success' : ''} ${isClosing ? 'card-closing' : ''}`}>
        {/* Animated background */}
        <div className="transfer-bg">
          <div className="transfer-wave" style={{ animationDuration: isActive ? '2s' : '0s' }} />
          <div className="transfer-wave wave-2" style={{ animationDuration: isActive ? '2.5s' : '0s' }} />
        </div>

        {/* Minimize button (only show during active transfer, not during success or error) */}
        {isActive && (
          <button
            className="transfer-minimize-btn"
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
            title="ย่อ"
            aria-label="ย่อหน้าต่างการถ่ายโอน"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}

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
                <span className="transfer-status-icon">{iconSvg}</span>
                <span className="transfer-status-text" style={{ color: config.color }}>{config.text}</span>
              </div>

              {/* E2E Encryption Indicator */}
              <div className="transfer-badges">
                <div className="transfer-e2e-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <span>E2E</span>
                </div>

                {/* Connection Type Badge */}
                {connectionType && (
                  <div className={`transfer-connection-badge ${connectionType}`}>
                    {connectionType === 'direct' && (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                        <span>Direct</span>
                      </>
                    )}
                    {connectionType === 'stun' && (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4" />
                          <path d="M12 8h.01" />
                        </svg>
                        <span>STUN</span>
                      </>
                    )}
                    {connectionType === 'relay' && (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
                        </svg>
                        <span>Relay</span>
                      </>
                    )}
                  </div>
                )}
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
                  <div className="transfer-progress-percent">{displayProgress.toFixed(1)}%</div>
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
                        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
                        <path d="m19 9-5 5-4-4-3 3" />
                      </svg>
                    </span>
                    <span>{formatBytes((progress / 100) * fileSize)} / {formatBytes(fileSize)}</span>
                  </div>
                  <div className="transfer-stat">
                    <span className="stat-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </span>
                    <span>{formatBytes(speed)}/s</span>
                  </div>
                  <div className="transfer-stat">
                    <span className="stat-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
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
          )
          }
        </div >
      </div >
    </div >
  );
}
