'use client';

import { useState, useEffect } from 'react';

interface NameModalProps {
  show: boolean;
  currentName: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export function NameModal({ show, currentName, onSubmit, onClose }: NameModalProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setName(currentName);
  }, [currentName, show]);

  if (!show) return null;

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim().slice(0, 20));
    }
    onClose();
  };

  return (
    <div className="modal show">
      <div className="modal-content modal-small">
        <div className="modal-icon">✏️</div>
        <div className="modal-title">ตั้งชื่อใหม่</div>
        <input
          type="text"
          className="name-input"
          placeholder="ชื่อของคุณ"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-reject" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-accept" onClick={handleSubmit}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}
