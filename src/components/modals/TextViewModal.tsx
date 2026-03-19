'use client';

// Lucide Icons
const FileTextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M10 9H8"/>
    <path d="M16 13H8"/>
    <path d="M16 17H8"/>
  </svg>
);

const ClipboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

interface TextViewModalProps {
  show: boolean;
  text: string;
  from: string;
  timestamp: string;
  onClose: () => void;
}

export function TextViewModal({ show, text, from, timestamp, onClose }: TextViewModalProps) {
  if (!show) return null;

  const handleCopy = () => {
    const btn = document.activeElement as HTMLButtonElement;
    const original = btn?.innerHTML || '';
    
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          if (btn) {
            btn.innerHTML = '<span style="color: inherit;">✓ คัดลอกแล้ว</span>';
            setTimeout(() => btn.innerHTML = original, 2000);
          }
        })
        .catch(() => {
          // Fallback to textarea method
          fallbackCopy(text, btn, original);
        });
    } else {
      // Fallback for older browsers
      fallbackCopy(text, btn, original);
    }
  };

  const fallbackCopy = (text: string, btn: HTMLButtonElement | null, originalHTML: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      if (btn) {
        btn.innerHTML = '<span style="color: inherit;">✓ คัดลอกแล้ว</span>';
        setTimeout(() => btn.innerHTML = originalHTML, 2000);
      }
    } catch (err) {
      console.error('Copy failed:', err);
      if (btn) {
        btn.innerHTML = '<span style="color: inherit;">✗ คัดลอกไม่สำเร็จ</span>';
        setTimeout(() => btn.innerHTML = originalHTML, 2000);
      }
    } finally {
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-text-view" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title"><FileTextIcon /> ข้อความ</h3>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="text-view-meta">
          <span className="text-view-from">จาก: {from}</span>
          <span className="text-view-time">{timestamp}</span>
        </div>

        <div className="text-view-content">
          {text}
        </div>

        <div className="modal-actions">
          <button className="btn btn-pastel lavender" onClick={handleCopy}>
            <ClipboardIcon /> คัดลอก
          </button>
          <button className="btn btn-accept" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
