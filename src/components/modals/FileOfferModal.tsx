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
  const isVideo = file.type.startsWith('video/') ||
    /\.(mp4|mov|m4v|webm)$/i.test(file.name);

  return (
    <div className="modal show">
      <div className="modal-content">
        <div className="modal-icon">📦</div>
        <div className="modal-title">มีพัสดุส่งมา!</div>
        <div className="modal-sender">{from.critter.emoji} {from.name}</div>
        
        <div className="modal-file" style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
          <span style={{ fontSize: '24px' }}>{isVideo ? '🎬' : '📄'}</span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
            <strong style={{ overflowWrap: 'anywhere', color: 'var(--text-primary)', display: 'block' }}>{file.name}</strong>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{formatFileSize(file.size)}</span>
          </div>
        </div>

        {isVideo && (
          <p className="modal-hint" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-12px', marginBottom: '18px', opacity: 0.85, lineHeight: 1.5, textAlign: 'left' }}>
            หลังรับเสร็จ ระบบจะแสดงปุ่มสำหรับบันทึกลง Photos หรือแกลเลอรี
          </p>
        )}
        
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
          <button className="btn btn-reject" onClick={onReject}>ปฏิเสธ</button>
          <button className="btn btn-accept" onClick={onAccept}>รับไฟล์</button>
        </div>
      </div>
    </div>
  );
}
