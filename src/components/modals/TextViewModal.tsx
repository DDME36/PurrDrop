'use client';

import { useState, useEffect } from 'react';

// Icons
const ClipboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (show) setCopied(false);
  }, [show]);

  if (!show) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Simple Linkify logic
  const renderText = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-link-clickable">
            {part} <ExternalLinkIcon />
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-text-view" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">ข้อความที่ได้รับ</h3>
            <p className="modal-subtitle">จาก: <strong>{from}</strong> • {timestamp}</p>
          </div>
          <button className="modal-close" onClick={onClose}><XIcon /></button>
        </div>

        <div className="text-view-scroll-area">
          <div className="text-view-main-content">
            {renderText(text)}
          </div>
        </div>

        <div className="modal-actions-grid">
          <button className={`btn btn-copy-action ${copied ? 'active' : ''}`} onClick={handleCopy}>
            {copied ? (
              <><CheckIcon /> คัดลอกสำเร็จ!</>
            ) : (
              <><ClipboardIcon /> คัดลอกข้อความ</>
            )}
          </button>
          <button className="btn btn-close-action" onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
