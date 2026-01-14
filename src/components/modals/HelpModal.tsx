'use client';

// Lucide Icons
const SmartphoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
    <path d="M12 18h.01"/>
  </svg>
);

const RefreshCwIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M8 16H3v5"/>
  </svg>
);

const PointerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-peach)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 14a8 8 0 0 1-8 8"/>
    <path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/>
    <path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/>
    <path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/>
    <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
  </svg>
);

const GiftIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-lavender)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="4" rx="1"/>
    <path d="M12 8v13"/>
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>
  </svg>
);

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

const FlowerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93"/>
    <path d="M17.5 6.5a4 4 0 0 1 0 5.66c-1.38 1.38-3.56 1.52-5.09.42"/>
    <path d="M20 12a4 4 0 0 1-4 4c-1.95 0-3.58-1.4-3.93-3.25"/>
    <path d="M17.5 17.5a4 4 0 0 1-5.66 0c-1.38-1.38-1.52-3.56-.42-5.09"/>
    <path d="M12 22a4 4 0 0 1-4-4c0-1.95 1.4-3.58 3.25-3.93"/>
    <path d="M6.5 17.5a4 4 0 0 1 0-5.66c1.38-1.38 3.56-1.52 5.09-.42"/>
    <path d="M4 12a4 4 0 0 1 4-4c1.95 0 3.58 1.4 3.93 3.25"/>
    <path d="M6.5 6.5a4 4 0 0 1 5.66 0c1.38 1.38 1.52 3.56.42 5.09"/>
  </svg>
);

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

export function HelpModal({ show, onClose }: HelpModalProps) {
  if (!show) return null;

  return (
    <div className="modal show">
      <div className="modal-content modal-help">
        <div className="modal-title">วิธีใช้งาน <FlowerIcon /></div>
        <div className="help-steps">
          <div className="help-step">
            <div className="step-icon"><SmartphoneIcon /></div>
            <div className="step-text">เปิด PurrDrop ในอุปกรณ์อื่น</div>
          </div>
          <div className="help-step">
            <div className="step-icon"><RefreshCwIcon /></div>
            <div className="step-text">
              เลือกโหมดเดียวกัน:
              <br />
              <small><EarthIcon /> สาธารณะ - เห็นทุกคน</small>
              <br />
              <small><WifiIcon /> WiFi - เฉพาะเครือข่ายเดียวกัน</small>
              <br />
              <small><LockIcon /> ส่วนตัว - ใช้รหัสห้อง 5 หลัก</small>
            </div>
          </div>
          <div className="help-step">
            <div className="step-icon"><PointerIcon /></div>
            <div className="step-text">แตะที่เพื่อนที่ต้องการส่งไฟล์</div>
          </div>
          <div className="help-step">
            <div className="step-icon"><GiftIcon /></div>
            <div className="step-text">เลือกไฟล์แล้วส่งเลย!</div>
          </div>
        </div>
        <button className="btn btn-close-modal" onClick={onClose}>เข้าใจแล้ว!</button>
      </div>
    </div>
  );
}
