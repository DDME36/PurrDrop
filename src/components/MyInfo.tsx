'use client';

import { Peer } from '@/lib/critters';

interface MyInfoProps {
  peer: Peer | null;
  connected: boolean;
  onEditName: () => void;
  onEditEmoji: () => void;
}

export function MyInfo({ peer, connected, onEditName, onEditEmoji }: MyInfoProps) {
  return (
    <div className={`my-critter-bar ${!connected ? 'offline' : ''}`}>
      <div 
        className="my-critter-avatar"
        style={{ background: peer ? `linear-gradient(135deg, ${peer.critter.color}, #fff)` : undefined }}
        onClick={onEditEmoji}
      >
        {peer?.critter.emoji || '🐱'}
      </div>
      <div className="my-critter-info">
        <div className="my-critter-name" onClick={onEditName}>
          {peer?.name || 'กำลังเชื่อมต่อ...'}
        </div>
        <div className="my-critter-status">
          <span className={`status-dot ${connected ? 'online' : ''}`} />
          <span>{connected ? 'เชื่อมต่อแล้ว' : 'ออฟไลน์'}</span>
        </div>
      </div>
    </div>
  );
}
