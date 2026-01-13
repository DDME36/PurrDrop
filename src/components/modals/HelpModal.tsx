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
            <div className="step-text">เปิด PurrDrop ในอุปกรณ์อื่น</div>
          </div>
          <div className="help-step">
            <div className="step-icon">🔄</div>
            <div className="step-text">
              เลือกโหมดเดียวกัน:
              <br />
              <small>🌐 สาธารณะ - เห็นทุกคน</small>
              <br />
              <small>📶 WiFi - เฉพาะเครือข่ายเดียวกัน</small>
              <br />
              <small>🔐 ส่วนตัว - ใช้รหัสห้อง 5 หลัก</small>
            </div>
          </div>
          <div className="help-step">
            <div className="step-icon">👆</div>
            <div className="step-text">แตะที่เพื่อนที่ต้องการส่งไฟล์</div>
          </div>
          <div className="help-step">
            <div className="step-icon">🎁</div>
            <div className="step-text">เลือกไฟล์แล้วส่งเลย!</div>
          </div>
        </div>
        <button className="btn btn-close-modal" onClick={onClose}>เข้าใจแล้ว!</button>
      </div>
    </div>
  );
}
