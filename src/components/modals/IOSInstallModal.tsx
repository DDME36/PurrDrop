'use client';

interface IOSInstallModalProps {
  show: boolean;
  onClose: () => void;
}

export function IOSInstallModal({ show, onClose }: IOSInstallModalProps) {
  if (!show) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-ios-install" onClick={e => e.stopPropagation()}>
        {/* iOS Icon */}
        <div className="modal-icon">📱</div>

        {/* Title */}
        <div className="modal-title">
          ติดตั้งแอปบน iOS
        </div>

        {/* Instructions */}
        <div className="ios-instructions">
          <div className="instruction-step">
            <div className="step-number">1</div>
            <div className="step-text">
              แตะปุ่ม <strong>"แชร์"</strong> (Share) 
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }}>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {' '}ด้านล่างหน้าจอ
            </div>
          </div>

          <div className="instruction-step">
            <div className="step-number">2</div>
            <div className="step-text">
              เลื่อนลงและเลือก <strong>"เพิ่มไปยังหน้าจอโฮม"</strong> (Add to Home Screen)
            </div>
          </div>

          <div className="instruction-step">
            <div className="step-number">3</div>
            <div className="step-text">
              กด <strong>"เพิ่ม"</strong> (Add) เพื่อยืนยัน
            </div>
          </div>
        </div>

        {/* Benefit */}
        <div className="ios-benefit">
          <strong>💡 ประโยชน์:</strong> เข้าถึงได้เร็วขึ้น ไม่ต้องเปิดเบราว์เซอร์ และใช้งานได้แบบ fullscreen
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            เข้าใจแล้ว
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-ios-install {
          max-width: 420px;
        }

        .ios-instructions {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 20px;
          text-align: left;
        }

        .instruction-step {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .step-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-pink), var(--accent-peach));
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }

        .step-text {
          flex: 1;
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
          padding-top: 4px;
        }

        .step-text strong {
          color: var(--text-primary);
          font-weight: 600;
        }

        .ios-benefit {
          font-size: 13px;
          color: var(--text-muted);
          padding: 12px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 12px;
          margin-bottom: 20px;
          text-align: left;
          line-height: 1.6;
        }

        .ios-benefit strong {
          color: var(--text-secondary);
        }

        [data-theme="dark"] .ios-benefit {
          background: rgba(59, 130, 246, 0.15);
        }
      `}</style>
    </div>
  );
}
