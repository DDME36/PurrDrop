'use client';

import { useState } from 'react';
import { formatFileSize } from '@/lib/utils';
import { isVideoFile } from '@/lib/webrtc';

interface DownloadReadyModalProps {
  show: boolean;
  fileName: string;
  fileSize: number;
  mimeType: string;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export function DownloadReadyModal({
  show,
  fileName,
  fileSize,
  mimeType,
  onSave,
  onDiscard,
}: DownloadReadyModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!show) return null;

  const video = isVideoFile(fileName, mimeType);

  const handleSave = async () => {
    if (saving) return;

    setSaving(true);
    setError('');

    try {
      await onSave();
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === 'AbortError'
      ) {
        // ผู้ใช้ปิด Share Sheet ไม่ใช่ system error
        return;
      }

      console.error(err);
      setError(
        'เปิดเมนูบันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="save-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-title"
    >
      <div className="save-sheet">
        <div
          className="save-sheet-handle"
          aria-hidden="true"
        />

        <header className="save-header">
          <div
            className={`save-icon ${
              video ? 'video' : 'file'
            }`}
            aria-hidden="true"
          >
            {video ? (
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect
                  x="3"
                  y="5"
                  width="14"
                  height="14"
                  rx="3"
                />
                <path d="m17 10 4-2v8l-4-2" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
              </svg>
            )}
          </div>

          <div className="save-heading">
            <h2 id="save-title">
              {video
                ? 'วิดีโอพร้อมบันทึก'
                : 'ไฟล์พร้อมบันทึก'}
            </h2>

            <p>
              รับไฟล์ครบและตรวจสอบเรียบร้อยแล้ว
            </p>
          </div>
        </header>

        <main className="save-body">
          <div className="save-file-card">
            <div className="save-file-info">
              <strong title={fileName}>
                {fileName}
              </strong>

              <span>
                {formatFileSize(fileSize)}
                {' · '}
                {video ? 'วิดีโอ' : 'ไฟล์'}
              </span>
            </div>

            <div
              className="save-ready-badge"
              aria-label="ไฟล์พร้อมบันทึก"
            >
              พร้อม
            </div>
          </div>

          <div className="save-tip">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 11v5" />
              <path d="M12 8h.01" />
            </svg>

            <p>
              {video
                ? 'แตะ “บันทึกวิดีโอ” แล้วเลือกบันทึกลง Photos หรือแกลเลอรี'
                : 'แตะ “บันทึกไฟล์” เพื่อเลือกตำแหน่งจัดเก็บ'}
            </p>
          </div>

          {error && (
            <div className="save-error" role="alert">
              {error}
            </div>
          )}
        </main>

        <footer className="save-actions">
          <button
            type="button"
            className="save-primary"
            disabled={saving}
            onClick={handleSave}
          >
            {saving
              ? 'กำลังเปิดเมนู...'
              : video
                ? 'บันทึกวิดีโอ'
                : 'บันทึกไฟล์'}
          </button>

          <button
            type="button"
            className="save-secondary"
            disabled={saving}
            onClick={onDiscard}
          >
            ปิดโดยไม่บันทึก
          </button>
        </footer>
      </div>

    </div>
  );
}
