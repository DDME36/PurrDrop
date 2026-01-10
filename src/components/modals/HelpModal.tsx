'use client';

interface HelpModalProps {
  show: boolean;
  onClose: () => void;
}

export function HelpModal({ show, onClose }: HelpModalProps) {
  if (!show) return null;

  return (
    <div className="modal show">
      <div className="modal-content modal-help">
        <div className="modal-title">วิธีใช้งาน 🌸</div>
        <div className="help-steps">
          <div className="help-step">
            <div className="step-icon">📱</div>
            <div className="step-text">เปิด Critters ในอุปกรณ์อื่น<br />ที่ใช้ Wi-Fi เดียวกัน</div>
          </div>
          <div className="help-step">
            <div className="step-icon">👆</div>
            <div className="step-text">แตะที่ Critter ของเพื่อน<br />ที่ต้องการส่งไฟล์ให้</div>
          </div>
          <div className="help-step">
            <div className="step-icon">🎁</div>
            <div className="step-text">เลือกไฟล์หรือถ่ายรูป<br />แล้วส่งเลย!</div>
          </div>
        </div>
        <button className="btn btn-close-modal" onClick={onClose}>เข้าใจแล้ว!</button>
      </div>
    </div>
  );
}
