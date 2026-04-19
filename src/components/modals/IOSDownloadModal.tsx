'use client';

interface IOSDownloadModalProps {
  show: boolean;
  filename: string;
  downloadUrl: string;
  onClose: () => void;
}

export function IOSDownloadModal({ show, filename, downloadUrl, onClose }: IOSDownloadModalProps) {
  if (!show) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-ios-download" onClick={e => e.stopPropagation()}>
        {/* iOS Icon */}
        <div className="modal-icon">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>

        {/* Title */}
        <div className="modal-title">
          วิธีดาวน์โหลดบน iOS
        </div>

        {/* Filename */}
        <div className="ios-filename">
          📄 {filename}
        </div>

        {/* Instructions */}
        <div className="ios-instructions">
          <div className="instruction-step">
            <div className="step-number">1</div>
            <div className="step-text">
              กดปุ่ม <strong>"ดาวน์โหลด"</strong> ด้านล่าง
            </div>
          </div>

          <div className="instruction-step">
            <div className="step-number">2</div>
            <div className="step-text">
              หน้าใหม่จะเปิดขึ้น → กด <strong>Share icon</strong> (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle' }}>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              )
            </div>
          </div>

          <div className="instruction-step">
            <div className="step-number">3</div>
            <div className="step-text">
              เลือก <strong>"Save to Files"</strong> หรือ <strong>"Save Image"</strong>
            </div>
          </div>
        </div>

        {/* Alternative method */}
        <div className="ios-alternative">
          <strong>หรือ:</strong> Long press ลิงก์ → เลือก "Download Linked File"
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <a 
            href={downloadUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-primary"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ดาวน์โหลด
          </a>
          <button className="btn btn-secondary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-ios-download {
          max-width: 420px;
        }

        .ios-filename {
          font-size: 14px;
          color: var(--text-secondary);
          padding: 12px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 12px;
          margin-bottom: 20px;
          word-break: break-all;
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

        .ios-alternative {
          font-size: 13px;
          color: var(--text-muted);
          padding: 12px;
          background: rgba(0, 0, 0, 0.03);
          border-radius: 12px;
          margin-bottom: 20px;
          text-align: left;
        }

        .ios-alternative strong {
          color: var(--text-secondary);
        }

        [data-theme="dark"] .ios-filename {
          background: rgba(59, 130, 246, 0.15);
        }

        [data-theme="dark"] .ios-alternative {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
