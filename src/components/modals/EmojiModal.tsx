'use client';

import { ANIMAL_EMOJIS } from '@/lib/critters';

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

interface EmojiModalProps {
  show: boolean;
  currentEmoji: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiModal({ show, currentEmoji, onSelect, onClose }: EmojiModalProps) {
  if (!show) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-emoji" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">เลือก Critter ของคุณ</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>
        <div className="emoji-grid">
          {ANIMAL_EMOJIS.map(emoji => (
            <button
              key={emoji}
              className={`emoji-option ${emoji === currentEmoji ? 'selected' : ''}`}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        <button className="btn btn-close-modal" onClick={onClose}>ยกเลิก</button>
      </div>
    </div>
  );
}
