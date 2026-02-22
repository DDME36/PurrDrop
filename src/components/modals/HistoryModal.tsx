'use client';

import { useState } from 'react';
import { TransferRecord, formatFileSize, formatTime, clearHistory } from '@/lib/transferHistory';
import { ConfirmModal } from './ConfirmModal';
import { TextViewModal } from './TextViewModal';

// Lucide Icons
const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17V3"/>
    <path d="m6 8 6-6 6 6"/>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15V3"/>
    <path d="m7 10 5 5 5-5"/>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  </svg>
);

const MessageSquareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const ClipboardListIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <path d="M12 11h4"/>
    <path d="M12 16h4"/>
    <path d="M8 11h.01"/>
    <path d="M8 16h.01"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const InboxIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

const CheckSmallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);

const XSmallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

const XCloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

interface HistoryModalProps {
  show: boolean;
  history: TransferRecord[];
  onClose: () => void;
  onClear: () => void;
}

export function HistoryModal({ show, history, onClose, onClear }: HistoryModalProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [viewingText, setViewingText] = useState<TransferRecord | null>(null);

  // Fallback copy method for browsers without clipboard API
  const fallbackCopy = (text: string, btn: HTMLButtonElement, originalHTML: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      btn.innerHTML = '✓';
      setTimeout(() => btn.innerHTML = originalHTML, 1000);
    } catch (err) {
      console.error('Copy failed:', err);
      btn.innerHTML = '✗';
      setTimeout(() => btn.innerHTML = originalHTML, 1000);
    } finally {
      document.body.removeChild(textarea);
    }
  };

  if (!show) return null;

  const handleClearClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmClear = () => {
    clearHistory();
    onClear();
    setShowConfirm(false);
  };

  const handleTextClick = (record: TransferRecord) => {
    if (record.type === 'text' && record.textContent) {
      setViewingText(record);
    }
  };

  return (
    <>
      <div className="modal show" onClick={onClose}>
        <div className="modal-content modal-history" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title"><ClipboardListIcon /> ประวัติการส่งไฟล์</h3>
            <button className="modal-close" onClick={onClose}><XCloseIcon /></button>
          </div>
          
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">
                <span className="history-empty-icon"><InboxIcon /></span>
                <p>ยังไม่มีประวัติ</p>
              </div>
            ) : (
              history.map(record => {
                if (record.type === 'text' || record.textContent || record.fileName === 'ข้อความ/ลิงก์') {
                  return (
                    <div key={record.id} className={`history-item text-message-card ${record.direction}`}>
                      <div className="history-icon">
                        <MessageSquareIcon />
                      </div>
                      <div className="history-info" onClick={() => handleTextClick(record)} style={{ cursor: 'pointer' }}>
                        <div className="text-message-header">
                          <span className="text-message-sender">
                            {record.direction === 'sent' ? `ส่งให้ ${record.peerName}` : `จาก ${record.peerName}`}
                          </span>
                          <div className="text-message-actions">
                            <span className="history-time">{formatTime(record.timestamp)}</span>
                            {record.textContent && (
                              <button 
                                className="history-copy-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const btn = e.currentTarget;
                                  const original = btn.innerHTML;
                                  
                                  // Try modern clipboard API first
                                  if (navigator.clipboard && navigator.clipboard.writeText) {
                                    navigator.clipboard.writeText(record.textContent!)
                                      .then(() => {
                                        btn.innerHTML = '✓';
                                        setTimeout(() => btn.innerHTML = original, 1000);
                                      })
                                      .catch(() => {
                                        // Fallback to textarea method
                                        fallbackCopy(record.textContent!, btn, original);
                                      });
                                  } else {
                                    // Fallback for older browsers
                                    fallbackCopy(record.textContent!, btn, original);
                                  }
                                }}
                                title="คัดลอก"
                              >
                                <ClipboardListIcon />
                              </button>
                            )}
                            <div className={`history-status ${record.success ? 'success' : 'failed'}`}>
                              {record.success ? <CheckSmallIcon /> : <XSmallIcon />}
                            </div>
                          </div>
                        </div>
                        {record.textContent && (
                          <div className="history-text-preview-container">
                            <div className="history-text-preview" title="คลิกเพื่ออ่านเต็ม">
                              {(() => {
                                const lines = record.textContent.split('\n');
                                const maxLines = 2;
                                const maxCharsPerLine = 50;
                                
                                // Take first 2 lines
                                let preview = lines.slice(0, maxLines).join('\n');
                                
                                // If there are more lines, add ellipsis
                                if (lines.length > maxLines) {
                                  preview += '...';
                                } else if (preview.length > maxCharsPerLine * maxLines) {
                                  // If total chars exceed limit, truncate
                                  preview = preview.substring(0, maxCharsPerLine * maxLines) + '...';
                                }
                                
                                return preview;
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Default layout for file transfers
                return (
                  <div key={record.id} className={`history-item ${record.direction}`}>
                    <div className="history-icon">
                      {record.direction === 'sent' ? <UploadIcon /> : <DownloadIcon />}
                    </div>
                    <div className="history-info">
                      <div className="history-filename">
                        <span className="history-filename-text">{record.fileName}</span>
                      </div>
                      <div className="history-meta">
                        <span>{formatFileSize(record.fileSize)}</span>
                        <span>•</span>
                        <span>{record.direction === 'sent' ? `ส่งให้ ${record.peerName}` : `จาก ${record.peerName}`}</span>
                      </div>
                    </div>
                    <div className="history-time">{formatTime(record.timestamp)}</div>
                    <div className={`history-status ${record.success ? 'success' : 'failed'}`}>
                      {record.success ? <CheckSmallIcon /> : <XSmallIcon />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {history.length > 0 && (
            <div className="history-actions">
              <button className="btn btn-pastel" onClick={handleClearClick}>
                <TrashIcon /> ล้างประวัติ
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        show={showConfirm}
        title="ล้างประวัติ"
        message="ต้องการล้างประวัติทั้งหมดหรือไม่?"
        confirmText="ล้าง"
        cancelText="ยกเลิก"
        onConfirm={handleConfirmClear}
        onCancel={() => setShowConfirm(false)}
      />

      <TextViewModal
        show={!!viewingText}
        text={viewingText?.textContent || ''}
        from={viewingText?.peerName || ''}
        timestamp={viewingText ? formatTime(viewingText.timestamp) : ''}
        onClose={() => setViewingText(null)}
      />
    </>
  );
}
