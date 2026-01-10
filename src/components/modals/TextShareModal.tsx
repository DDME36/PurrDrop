'use client';

import { useState } from 'react';
import { Peer } from '@/lib/critters';

interface TextShareModalProps {
  show: boolean;
  peers: Peer[];
  onSend: (peer: Peer, text: string) => void;
  onClose: () => void;
}

export function TextShareModal({ show, peers, onSend, onClose }: TextShareModalProps) {
  const [text, setText] = useState('');
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);

  if (!show) return null;

  const handleSend = () => {
    if (!text.trim() || !selectedPeer) return;
    onSend(selectedPeer, text.trim());
    setText('');
    setSelectedPeer(null);
    onClose();
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) setText(clipText);
    } catch {
      // Clipboard access denied
    }
  };

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-text-share" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📝 ส่งข้อความ</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="text-share-content">
          <div className="text-input-wrap">
            <textarea
              className="text-input"
              placeholder="พิมพ์ข้อความหรือวาง URL..."
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
            />
            <button className="btn-paste" onClick={handlePaste} title="วางจาก Clipboard">
              📋
            </button>
          </div>

          <div className="peer-select">
            <p className="peer-select-label">ส่งให้:</p>
            <div className="peer-select-list">
              {peers.length === 0 ? (
                <p className="no-peers">ไม่มีเพื่อนออนไลน์</p>
              ) : (
                peers.map(peer => (
                  <button
                    key={peer.id}
                    className={`peer-select-item ${selectedPeer?.id === peer.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPeer(peer)}
                  >
                    <span className="peer-emoji">{peer.critter.emoji}</span>
                    <span className="peer-name">{peer.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-pastel" onClick={onClose}>ยกเลิก</button>
          <button 
            className="btn btn-accept" 
            onClick={handleSend}
            disabled={!text.trim() || !selectedPeer}
          >
            ส่ง
          </button>
        </div>
      </div>
    </div>
  );
}
