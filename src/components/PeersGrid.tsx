'use client';

import { Peer } from '@/lib/critters';
import { PeerCard } from './PeerCard';

interface PeersGridProps {
  peers: Peer[];
  newPeerIds: Set<string>;
  onSelectPeer: (peer: Peer) => void;
  onDropFiles: (peer: Peer, files: FileList) => void;
}

export function PeersGrid({ peers, newPeerIds, onSelectPeer, onDropFiles }: PeersGridProps) {
  if (peers.length === 0) return null;

  return (
    <div className="peers-section show">
      <div className="section-title">
        <span>เพื่อน ๆ ในเครือข่าย</span>
        <span className="peer-count">{peers.length}</span>
      </div>
      <div className="peers-grid">
        {peers.map(peer => (
          <PeerCard
            key={peer.id}
            peer={peer}
            isNew={newPeerIds.has(peer.id)}
            onSelect={onSelectPeer}
            onDrop={onDropFiles}
          />
        ))}
      </div>
    </div>
  );
}
