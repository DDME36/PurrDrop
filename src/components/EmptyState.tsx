'use client';

// Lucide Icons
const EarthIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/>
    <path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/>
    <path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/>
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

const WifiIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h.01"/>
    <path d="M2 8.82a15 15 0 0 1 20 0"/>
    <path d="M5 12.859a10 10 0 0 1 14 0"/>
    <path d="M8.5 16.429a5 5 0 0 1 7 0"/>
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const QrCodeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="5" height="5" x="3" y="3" rx="1"/>
    <rect width="5" height="5" x="16" y="3" rx="1"/>
    <rect width="5" height="5" x="3" y="16" rx="1"/>
    <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
    <path d="M21 21v.01"/>
    <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
    <path d="M3 12h.01"/>
    <path d="M12 3h.01"/>
    <path d="M12 16v.01"/>
    <path d="M16 12h1"/>
    <path d="M21 12v.01"/>
    <path d="M12 21v-1"/>
  </svg>
);

const HelpCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <path d="M12 17h.01"/>
  </svg>
);

const MessageCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
  </svg>
);

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
        <span className="empty-modes"><EarthIcon /> สาธารณะ &nbsp;|&nbsp; <WifiIcon /> WiFi เดียวกัน &nbsp;|&nbsp; <LockIcon /> รหัสห้อง</span>
      </div>
      <div className="empty-actions">
        <button className="btn btn-pastel pink" onClick={onShowQR}>
          <span className="btn-icon"><QrCodeIcon /></span> QR Code
        </button>
        <button className="btn btn-pastel mint" onClick={onShowHelp}>
          <span className="btn-icon"><HelpCircleIcon /></span> วิธีใช้
        </button>
      </div>
      
      {/* Feedback button - inline (ไม่ fixed) */}
      <div className="empty-feedback">
        <button className="feedback-badge" onClick={onShowFeedback}>
          <MessageCircleIcon /> Feedback
        </button>
      </div>
      
      <div className="empty-footer-mobile">
        <div className="footer-credit">by ddme36 (Dome)</div>
      </div>
    </div>
  );
}
