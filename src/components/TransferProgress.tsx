'use client';

interface TransferProgressProps {
  fileName: string;
  progress: number;
  status: 'sending' | 'receiving' | 'complete' | 'error';
  emoji: string;
}

export function TransferProgress({ fileName, progress, status, emoji }: TransferProgressProps) {
  const statusText = {
    sending: 'กำลังส่ง...',
    receiving: 'กำลังรับ...',
    complete: 'เสร็จแล้ว!',
    error: 'เกิดข้อผิดพลาด',
  };

  return (
    <div className={`transfer-section show ${status === 'receiving' ? 'receiving' : ''}`}>
      <div className="transfer-item">
        <div className="transfer-critter">{emoji}</div>
        <div className="transfer-content">
          <div className="transfer-info">
            <span className="transfer-name">{fileName}</span>
            <span className="transfer-status">{statusText[status]}</span>
          </div>
          <div className="transfer-progress">
            <div className="transfer-bar" style={{ width: `${100 - progress}%` }} />
            <div className="transfer-gift" style={{ left: `${progress}%` }}>📦</div>
          </div>
        </div>
      </div>
    </div>
  );
}
