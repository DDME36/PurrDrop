'use client';

interface EmptyStateProps {
  emoji: string;
  onShowQR: () => void;
  onShowHelp: () => void;
  onShowFeedback: () => void;
}

export function EmptyState({ emoji, onShowQR, onShowHelp, onShowFeedback }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-critter-container">
        <div className="empty-cloud" />
        <div className="empty-critter">{emoji}</div>
      </div>
      <div className="empty-message">รอเพื่อนอยู่เลยนะ ~</div>
      <div className="empty-hint">
        เปิด PurrDrop ในเครื่องอื่น แล้วเลือกโหมดเดียวกัน
        <br />
        <span className="empty-modes">🌐 สาธารณะ &nbsp;|&nbsp; 📶 WiFi เดียวกัน &nbsp;|&nbsp; 🔐 รหัสห้อง</span>
      </div>
      <div className="empty-actions">
        <button className="btn btn-pastel pink" onClick={onShowQR}>
          <span className="btn-icon">⎔</span> QR Code
        </button>
        <button className="btn btn-pastel mint" onClick={onShowHelp}>
          <span className="btn-icon">?</span> วิธีใช้
        </button>
      </div>
      
      {/* Mobile only - inline feedback */}
      <div className="empty-footer-mobile">
        <button className="feedback-btn" onClick={onShowFeedback}>
          💬 Feedback
        </button>
        <div className="footer-credit">by ddme36 (Dome)</div>
      </div>
    </div>
  );
}
