'use client';

import { useEffect, useState, useRef } from 'react';

interface TransferProgressProps {
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'sending' | 'receiving' | 'complete' | 'error';
  emoji: string;
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

export function TransferProgress({ fileName, fileSize, progress, status, emoji }: TransferProgressProps) {
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const lastUpdateRef = useRef({ time: Date.now(), bytes: 0 });
  const speedHistoryRef = useRef<number[]>([]);

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

  // Calculate speed and ETA
  useEffect(() => {
    const now = Date.now();
    const currentBytes = (progress / 100) * fileSize;
    const timeDiff = (now - lastUpdateRef.current.time) / 1000;
    const bytesDiff = currentBytes - lastUpdateRef.current.bytes;

    if (timeDiff > 0.1 && bytesDiff > 0) {
      const currentSpeed = bytesDiff / timeDiff;
      
      // Rolling average for smoother speed display
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
      setSpeed(0);
      setEta(0);
    }
  }, [progress]);

  const statusConfig = {
    sending: { text: 'กำลังส่ง', icon: '📤', color: 'var(--accent-mint)' },
    receiving: { text: 'กำลังรับ', icon: '📥', color: 'var(--accent-peach)' },
    complete: { text: 'เสร็จแล้ว!', icon: '✅', color: 'var(--accent-mint)' },
    error: { text: 'ผิดพลาด', icon: '❌', color: '#ff6b6b' },
  };

  const config = statusConfig[status];
  const isActive = status === 'sending' || status === 'receiving';

  return (
    <div className={`transfer-overlay ${status === 'complete' ? 'complete' : ''}`}>
      <div className="transfer-card">
        {/* Animated background */}
        <div className="transfer-bg">
          <div className="transfer-wave" style={{ animationDuration: isActive ? '2s' : '0s' }} />
          <div className="transfer-wave wave-2" style={{ animationDuration: isActive ? '2.5s' : '0s' }} />
        </div>

        {/* Content */}
        <div className="transfer-content">
          {/* Emoji with pulse */}
          <div className={`transfer-emoji ${isActive ? 'pulse' : status === 'complete' ? 'bounce' : ''}`}>
            {status === 'complete' ? '🎉' : emoji}
          </div>

          {/* Status */}
          <div className="transfer-status-row">
            <span className="transfer-status-icon">{config.icon}</span>
            <span className="transfer-status-text" style={{ color: config.color }}>{config.text}</span>
          </div>

          {/* File name */}
          <div className="transfer-filename">{fileName}</div>

          {/* Progress bar */}
          <div className="transfer-progress-container">
            <div className="transfer-progress-track">
              <div 
                className="transfer-progress-fill"
                style={{ 
                  width: `${displayProgress}%`,
                  background: `linear-gradient(90deg, ${config.color}, var(--accent-pink))`,
                }}
              />
              {isActive && (
                <div 
                  className="transfer-progress-glow"
                  style={{ left: `${displayProgress}%` }}
                />
              )}
            </div>
            <div className="transfer-progress-text">{Math.round(displayProgress)}%</div>
          </div>

          {/* Stats */}
          {isActive && fileSize > 0 && (
            <div className="transfer-stats">
              <div className="transfer-stat">
                <span className="stat-icon">📊</span>
                <span>{formatBytes((progress / 100) * fileSize)} / {formatBytes(fileSize)}</span>
              </div>
              <div className="transfer-stat">
                <span className="stat-icon">⚡</span>
                <span>{formatBytes(speed)}/s</span>
              </div>
              <div className="transfer-stat">
                <span className="stat-icon">⏱️</span>
                <span>{formatTime(eta)}</span>
              </div>
            </div>
          )}

          {/* Complete message */}
          {status === 'complete' && (
            <div className="transfer-complete-msg">
              ส่งสำเร็จ! 🎊
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
