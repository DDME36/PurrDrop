'use client';

import { Peer } from '@/lib/critters';
import { formatFileSize } from '@/lib/utils';

interface FileOfferModalProps {
  show: boolean;
  from: Peer;
  file: { name: string; size: number; type: string };
  onAccept: () => void;
  onReject: () => void;
}

export function FileOfferModal({ show, from, file, onAccept, onReject }: FileOfferModalProps) {
  if (!show) return null;

  const isLargeFile = file.size > 50 * 1024 * 1024; // > 50MB

  return (
    <div className="modal show">
      <div className="modal-content">
        <div className="modal-icon">📦</div>
        <div className="modal-title">มีพัสดุส่งมา!</div>
        <div className="modal-sender">{from.critter.emoji} {from.name}</div>
        <div className="modal-file">{file.name} ({formatFileSize(file.size)})</div>
        
        {isLargeFile && (
          <div className="modal-warning">
            <div className="warning-icon">💡</div>
            <div className="warning-text">
              <strong>ไฟล์ใหญ่กว่า 50MB</strong>
              <br />
              แนะนำให้ใช้ WiFi เดียวกันเพื่อส่งเร็วและประหยัด server
            </div>
          </div>
        )}
        
        <div className="modal-actions">
          <button className="btn btn-reject" onClick={onReject}>ไม่รับ</button>
          <button className="btn btn-accept" onClick={onAccept}>รับเลย!</button>
        </div>
      </div>
    </div>
  );
}
