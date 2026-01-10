'use client';

import { useState } from 'react';
import { TransferRecord, formatFileSize, formatTime, clearHistory } from '@/lib/transferHistory';
import { ConfirmModal } from './ConfirmModal';

interface HistoryModalProps {
  show: boolean;
  history: TransferRecord[];
  onClose: () => void;
  onClear: () => void;
}

export function HistoryModal({ show, history, onClose, onClear }: HistoryModalProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (!show) return null;

  const handleClearClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmClear = () => {
    clearHistory();
    onClear();
    setShowConfirm(false);
  };

  return (
    <>
      <div className="modal show" onClick={onClose}>
        <div className="modal-content modal-history" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">📋 ประวัติการส่งไฟล์</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">
                <span className="history-empty-icon">📭</span>
                <p>ยังไม่มีประวัติ</p>
              </div>
            ) : (
              history.map(record => (
                <div key={record.id} className={`history-item ${record.direction}`}>
                  <div className="history-icon">
                    {record.direction === 'sent' ? '📤' : '📥'}
                  </div>
                  <div className="history-info">
                    <div className="history-filename">{record.fileName}</div>
                    <div className="history-meta">
                      <span>{formatFileSize(record.fileSize)}</span>
                      <span>•</span>
                      <span>{record.direction === 'sent' ? `ส่งให้ ${record.peerName}` : `จาก ${record.peerName}`}</span>
                    </div>
                  </div>
                  <div className="history-time">{formatTime(record.timestamp)}</div>
                  <div className={`history-status ${record.success ? 'success' : 'failed'}`}>
                    {record.success ? '✓' : '✕'}
                  </div>
                </div>
              ))
            )}
          </div>

          {history.length > 0 && (
            <div className="history-actions">
              <button className="btn btn-pastel" onClick={handleClearClick}>
                🗑️ ล้างประวัติ
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
    </>
  );
}
