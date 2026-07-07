'use client';

import { Peer } from '@/lib/critters';
import { useTheme } from '@/hooks/useTheme';
import { ConnectionStatus } from '@/hooks/usePeerConnection';
import { useState, useEffect } from 'react';

interface MyInfoProps {
  peer: Peer | null;
  connected: boolean;
  connectionStatus: ConnectionStatus;
  onEditName: () => void;
  onEditEmoji: () => void;
}

const statusText: Record<ConnectionStatus, string> = {
  connecting: 'กำลังเชื่อมต่อ...',
  connected: 'เชื่อมต่อแล้ว',
  reconnecting: 'กำลังเชื่อมต่อใหม่...',
  disconnected: 'ออฟไลน์',
};

export function MyInfo({ peer, connected, connectionStatus, onEditName, onEditEmoji }: MyInfoProps) {
  const { isDark } = useTheme();

  const avatarGradient = peer
    ? isDark
      ? peer.critter.color
      : `linear-gradient(135deg, ${peer.critter.color}, #fff)`
    : undefined;

  return (
    <div className="my-info-container">
      <div className={`my-critter-bar ${!connected ? 'offline' : ''}`}>
        <div
          className="my-critter-avatar"
          style={{ background: avatarGradient }}
          onClick={onEditEmoji}
        >
          <div className="emoji-breathe-wrapper">
            <div className="emoji-hover-target">
              {peer?.critter.emoji || '🐱'}
            </div>
          </div>
        </div>
        <div className="my-critter-info">
          <div className="my-critter-name" onClick={onEditName}>
            {peer?.name || 'กำลังเชื่อมต่อ...'}
          </div>
          <div className="my-critter-status">
            <span className={`status-dot ${connectionStatus}`} />
            <span>{statusText[connectionStatus]}</span>
          </div>
        </div>
      </div>


    </div>
  );
}
