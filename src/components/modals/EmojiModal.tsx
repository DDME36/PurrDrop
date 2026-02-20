'use client';

import { ANIMAL_EMOJIS } from '@/lib/critters';

interface EmojiModalProps {
  show: boolean;
  currentEmoji: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiModal({ show, currentEmoji, onSelect, onClose }: EmojiModalProps) {
  if (!show) return null;

  return (
    <div className="modal show">
      <div className="modal-content modal-emoji">
        <div className="modal-title">เลือก Critter ของคุณ</div>
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
