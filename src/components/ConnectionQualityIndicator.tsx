'use client';

import React from 'react';
import { getConnectionRouteInfo, type ConnectionType } from '@/lib/webrtc';

interface ConnectionQualityIndicatorProps {
  connectionType?: ConnectionType;
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  rtt?: number;
  packetLoss?: number;
}

export function ConnectionQualityIndicator({
  connectionType,
  quality: propQuality,
  rtt = 0,
  packetLoss = 0,
}: ConnectionQualityIndicatorProps) {
  let quality: 'excellent' | 'good' | 'fair' | 'poor' = propQuality || 'good';

  if (!propQuality) {
    if (rtt < 50 && packetLoss < 1) {
      quality = 'excellent';
    } else if (rtt < 150 && packetLoss < 3) {
      quality = 'good';
    } else if (rtt < 300 && packetLoss < 5) {
      quality = 'fair';
    } else {
      quality = 'poor';
    }
  }

  const qualityConfig = {
    excellent: { color: '#10b981', label: 'ยอดเยี่ยม', icon: '⚡', bars: 4 },
    good: { color: '#3b82f6', label: 'ดี', icon: '✓', bars: 3 },
    fair: { color: '#f59e0b', label: 'พอใช้', icon: '~', bars: 2 },
    poor: { color: '#ef4444', label: 'อ่อน', icon: '!', bars: 1 },
  };

  const routeInfo = getConnectionRouteInfo(connectionType);
  const config = qualityConfig[quality];

  const routeColors: Record<ConnectionType, string> = {
    direct: '#10b981',
    stun: '#3b82f6',
    relay: '#f59e0b',
  };
  const routeColor = connectionType ? routeColors[connectionType] : config.color;

  return (
    <div className="connection-quality">
      <div className="signal-bars" aria-hidden="true">
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

      <div className="quality-label" style={{ color: config.color }}>
        <span className="quality-icon">{config.icon}</span>
        <span className="quality-text">{config.label}</span>
      </div>

      {routeInfo && connectionType && (
        <div
          className={`connection-type-badge ${connectionType}`}
          style={{
            background: `${routeColor}1f`,
            color: routeColor,
            borderColor: `${routeColor}42`,
          }}
          title={routeInfo.serverRole}
        >
          {routeInfo.shortLabel}
        </div>
      )}

      {rtt > 0 && (
        <div className="connection-rtt">{rtt}ms</div>
      )}

      <style jsx>{`
        .connection-quality {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 999px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .signal-bars {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 16px;
          width: 20px;
          flex-shrink: 0;
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
          font-weight: 700;
          white-space: nowrap;
        }

        .quality-icon {
          font-size: 13px;
        }

        .connection-type-badge {
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid;
          white-space: nowrap;
        }

        .connection-rtt {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }

        [data-theme="dark"] .connection-quality {
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
        }

        [data-theme="dark"] .signal-bar:not(.active) {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
