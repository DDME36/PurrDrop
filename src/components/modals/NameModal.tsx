'use client';

import { useState, useEffect, useRef } from 'react';

interface NameModalProps {
  show: boolean;
  currentName: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export function NameModal({ show, currentName, onSubmit, onClose }: NameModalProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(currentName);
  }, [currentName, show]);

  // Scroll input into view when keyboard opens (iOS fix)
  useEffect(() => {
    if (show && inputRef.current) {
      // Small delay to let modal render
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [show]);

  if (!show) return null;

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim().slice(0, 20));
    }
    onClose();
  };

  const handleFocus = () => {
    // Scroll to input when focused (iOS keyboard fix)
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  return (
    <div className="modal show modal-keyboard-aware">
      <div className="modal-content modal-small modal-input-modal">
        <div className="modal-icon">✏️</div>
        <div className="modal-title">ตั้งชื่อใหม่</div>
        <input
          ref={inputRef}
          type="text"
          className="name-input"
          placeholder="ชื่อของคุณ"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          onFocus={handleFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-reject" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-accept" onClick={handleSubmit}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}
