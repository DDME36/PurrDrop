'use client';

import { Peer } from '@/lib/critters';
import { useRef } from 'react';

interface PeerCardProps {
  peer: Peer;
  isNew?: boolean;
  onSelect: (peer: Peer) => void;
  onDrop: (peer: Peer, files: FileList) => void;
}

export function PeerCard({ peer, isNew, onSelect, onDrop }: PeerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cardRef.current?.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cardRef.current?.contains(e.relatedTarget as Node)) {
      cardRef.current?.classList.remove('drag-over');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cardRef.current?.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      onDrop(peer, e.dataTransfer.files);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`peer-card ${isNew ? 'entering' : ''}`}
      style={{ '--critter-color': peer.critter.color } as React.CSSProperties}
      onClick={() => onSelect(peer)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="heart-float">💕</span>
      <div className="drop-overlay">
        <span className="drop-icon">📦</span>
        <span className="drop-text">วางที่นี่!</span>
      </div>
      <div className="peer-cloud">
        <div className="peer-critter">{peer.critter.emoji}</div>
      </div>
      <div className="peer-name">{peer.name}</div>
      <div className="peer-device">{peer.device}</div>
    </div>
  );
}
