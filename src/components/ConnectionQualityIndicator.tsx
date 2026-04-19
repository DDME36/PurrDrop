'use client';

import { useState, useEffect } from 'react';

interface ConnectionQualityIndicatorProps {
  connectionType?: 'direct' | 'stun' | 'relay';
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  rtt?: number; // Round-trip time in ms
  packetLoss?: number; // Percentage
}

export function ConnectionQualityIndicator({ 
  connectionType, 
  quality: propQuality,
  rtt = 0, 
  packetLoss = 0 
}: ConnectionQualityIndicatorProps) {
  const [quality, setQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>(propQuality || 'good');

  useEffect(() => {
    // Use prop quality if provided
    if (propQuality) {
      setQuality(propQuality);
      return;
    }
    
    // Otherwise calculate from RTT and packet loss
    if (rtt < 50 && packetLoss < 1) {
      setQuality('excellent');
    } else if (rtt < 150 && packetLoss < 3) {
      setQuality('good');
    } else if (rtt < 300 && packetLoss < 5) {
      setQuality('fair');
    } else {
      setQuality('poor');
    }
  }, [rtt, packetLoss, propQuality]);

  const qualityConfig = {
    excellent: {
      color: '#10b981',
      label: 'ยอดเยี่ยม',
      icon: '⚡',
      bars: 4,
    },
    good: {
      color: '#3b82f6',
      label: 'ดี',
      icon: '✓',
      bars: 3,
    },
    fair: {
      color: '#f59e0b',
      label: 'พอใช้',
      icon: '~',
      bars: 2,
    },
    poor: {
      color: '#ef4444',
      label: 'อ่อน',
      icon: '!',
      bars: 1,
    },
  };

  const config = qualityConfig[quality];

  const connectionTypeConfig = {
    direct: { label: 'P2P โดยตรง', color: '#10b981' },
    stun: { label: 'P2P (STUN)', color: '#3b82f6' },
    relay: { label: 'ผ่าน Server', color: '#f59e0b' },
  };

  return (
    <div className="connection-quality">
      {/* Signal Bars */}
      <div className="signal-bars">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={`signal-bar ${bar <= config.bars ? 'active' : ''}`}
            style={{
              height: `${bar * 25}%`,
              background: bar <= config.bars ? config.color : 'rgba(0, 0, 0, 0.1)',
            }}
          />
        ))}
      </div>

      {/* Quality Label */}
      <div className="quality-label" style={{ color: config.color }}>
        <span className="quality-icon">{config.icon}</span>
        <span className="quality-text">{config.label}</span>
      </div>

      {/* Connection Type */}
      {connectionType && (
        <div 
          className="connection-type-badge"
          style={{ 
            background: `${connectionTypeConfig[connectionType].color}20`,
            color: connectionTypeConfig[connectionType].color,
            borderColor: `${connectionTypeConfig[connectionType].color}40`,
          }}
        >
          {connectionTypeConfig[connectionType].label}
        </div>
      )}

      {/* Stats (optional, for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="connection-stats">
          <span>RTT: {rtt}ms</span>
          <span>Loss: {packetLoss.toFixed(1)}%</span>
        </div>
      )}

      <style jsx>{`
        .connection-quality {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--bg-card);
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .signal-bars {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 16px;
          width: 20px;
        }

        .signal-bar {
          flex: 1;
          border-radius: 2px;
          transition: all 0.3s ease;
        }

        .quality-label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .quality-icon {
          font-size: 14px;
        }

        .connection-type-badge {
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid;
        }

        .connection-stats {
          display: flex;
          gap: 8px;
          font-size: 10px;
          color: var(--text-muted);
          margin-left: auto;
        }

        [data-theme="dark"] .connection-quality {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        [data-theme="dark"] .signal-bar:not(.active) {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
