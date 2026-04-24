'use client';

import { useState } from 'react';
import { TransferRecord, formatFileSize, formatTime, clearHistory, removeFromHistory } from '@/lib/transferHistory';
import { ConfirmModal } from './ConfirmModal';
import { TextViewModal } from './TextViewModal';

// Icons
const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17V3"/><path d="m6 8 6-6 6 6"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
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
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const InboxIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

const XSmallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>
);

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
  </svg>
);

interface HistoryModalProps {
  show: boolean;
  history: TransferRecord[];
  onClose: () => void;
  onClear: () => void;
  onRemoveItem: (id: string) => void;
}

export function HistoryModal({ show, history, onClose, onClear, onRemoveItem }: HistoryModalProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [viewingText, setViewingText] = useState<TransferRecord | null>(null);

  if (!show) return null;

  const handleClearClick = () => setShowConfirm(true);
  
  const handleConfirmClear = () => {
    clearHistory();
    onClear();
    setShowConfirm(false);
  };

  const handleRemoveSingle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeFromHistory(id);
    onRemoveItem(id);
  };

  const handleReshareText = (e: React.MouseEvent, record: TransferRecord) => {
    e.stopPropagation();
    if (record.textContent) {
      (window as any).triggerTextShare?.(record.textContent);
      onClose();
    }
  };

  const handleTextClick = (record: TransferRecord) => {
    if (record.textContent) setViewingText(record);
  };

  return (
    <>
      <div className="modal show" onClick={onClose}>
        <div className="modal-content modal-history" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title-group">
              <h3 className="modal-title"><ClipboardListIcon /> ประวัติการใช้งาน</h3>
              <p className="modal-subtitle">รายการที่คุณส่งและรับ</p>
            </div>
            <div className="header-actions-row">
              {history.length > 0 && (
                <button className="btn-icon-history trash" onClick={handleClearClick} title="ล้างทั้งหมด">
                  <TrashIcon />
                </button>
              )}
              <button className="modal-close" onClick={onClose}><XSmallIcon /></button>
            </div>
          </div>
          
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">
                <span className="history-empty-icon"><InboxIcon /></span>
                <p>ยังไม่มีประวัติการส่งไฟล์</p>
              </div>
            ) : (
              history.map(record => {
                const isText = record.type === 'text' || record.textContent || record.fileName === 'ข้อความ/ลิงก์';
                
                return (
                  <div key={record.id} className={`history-card ${record.direction} ${isText ? 'text-card' : ''}`}>
                    <div className="history-card-main">
                      <div className="history-icon-box">
                        {isText ? <MessageSquareIcon /> : (record.direction === 'sent' ? <UploadIcon /> : <DownloadIcon />)}
                      </div>
                      
                      <div className="history-details" onClick={() => isText && handleTextClick(record)}>
                        <div className="history-row-top">
                          <span className="history-peer">
                            {record.direction === 'sent' ? `ส่งให้ ${record.peerName}` : `รับจาก ${record.peerName}`}
                          </span>
                          <span className="history-time-tag">{formatTime(record.timestamp)}</span>
                        </div>
                        
                        <div className="history-row-mid">
                          <span className="history-name-text">{record.fileName}</span>
                          {!isText && <span className="history-size-tag">{formatFileSize(record.fileSize)}</span>}
                        </div>

                        {isText && record.textContent && (
                          <div className="history-preview-box">
                            {record.textContent.substring(0, 80)}{record.textContent.length > 80 ? '...' : ''}
                          </div>
                        )}
                      </div>

                      <div className="history-actions-box">
                        {isText && (
                          <button className="action-circle reshare" onClick={(e) => handleReshareText(e, record)} title="ส่งต่อ">
                            <SendIcon />
                          </button>
                        )}
                        <button className="action-circle remove" onClick={(e) => handleRemoveSingle(e, record.id)} title="ลบ">
                          <XSmallIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        show={showConfirm}
        title="ล้างประวัติ"
        message="ต้องการล้างประวัติทั้งหมดหรือไม่?"
        confirmText="ล้างทั้งหมด"
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
