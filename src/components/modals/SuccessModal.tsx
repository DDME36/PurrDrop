'use client';

import { useEffect } from 'react';

interface SuccessModalProps {
  show: boolean;
  myEmoji: string;
  myName: string;
  peerEmoji: string;
  peerName: string;
  onClose: () => void;
}

export function SuccessModal({ show, myEmoji, myName, peerEmoji, peerName, onClose }: SuccessModalProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="modal show">
      <div className="modal-content modal-success">
        <div className="success-critters">
          <div className="success-critter-wrap left">
            <span className="success-critter">{myEmoji}</span>
            <span className="success-name">{myName}</span>
          </div>
          <span className="success-package">📦</span>
          <div className="success-critter-wrap right">
            <span className="success-critter">{peerEmoji}</span>
            <span className="success-name">{peerName}</span>
          </div>
        </div>
        <div className="modal-title">ส่งให้เรียบร้อยย ♡</div>
      </div>
    </div>
  );
}
