'use client';

interface EmptyStateProps {
  emoji: string;
  onShowQR: () => void;
  onShowHelp: () => void;
}

export function EmptyState({ emoji, onShowQR, onShowHelp }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-critter-container">
        <div className="empty-cloud" />
        <div className="empty-critter">{emoji}</div>
      </div>
      <div className="empty-message">รอเพื่อนอยู่เลยนะ ~</div>
      <div className="empty-hint">เปิด PurrDrop ในเครื่องอื่นใน Wi-Fi เดียวกันสิ!</div>
      <div className="empty-actions">
        <button className="btn btn-pastel pink" onClick={onShowQR}>
          <span className="btn-icon">⎔</span> แสดง QR Code
        </button>
        <button className="btn btn-pastel mint" onClick={onShowHelp}>
          <span className="btn-icon">?</span> วิธีใช้งาน
        </button>
      </div>
    </div>
  );
}
