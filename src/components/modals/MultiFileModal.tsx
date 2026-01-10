'use client';

import { formatFileSize } from '@/lib/utils';

interface MultiFileModalProps {
  show: boolean;
  fileCount: number;
  totalSize: number;
  onZip: () => void;
  onSeparate: () => void;
  onCancel: () => void;
}

export function MultiFileModal({ show, fileCount, totalSize, onZip, onSeparate, onCancel }: MultiFileModalProps) {
  if (!show) return null;

  return (
    <div className="modal show">
      <div className="modal-content modal-small">
        <div className="modal-icon">📦</div>
        <div className="modal-title">ส่งหลายไฟล์</div>
        <div className="modal-file">{fileCount} ไฟล์ ({formatFileSize(totalSize)})</div>
        <div className="modal-actions-vertical">
          <button className="btn btn-accept" onClick={onZip}>
            📦 รวมเป็น ZIP
          </button>
          <button className="btn btn-pastel" onClick={onSeparate}>
            📄 ส่งทีละไฟล์
          </button>
          <button className="btn btn-reject" onClick={onCancel}>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
