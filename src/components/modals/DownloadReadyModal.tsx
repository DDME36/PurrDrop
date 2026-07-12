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

      <style jsx>{`
        .save-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-top: env(safe-area-inset-top);
          background: rgba(20, 18, 24, 0.52);
        }

        .save-sheet {
          width: 100%;
          max-width: 480px;
          max-height: calc(
            100dvh - env(safe-area-inset-top) - 12px
          );
          overflow-y: auto;
          border: 1px solid var(--border-color);
          border-bottom: 0;
          border-radius: 24px 24px 0 0;
          background: var(--surface-primary);
          box-shadow: 0 -12px 36px rgba(0, 0, 0, 0.16);
        }

        .save-sheet-handle {
          width: 40px;
          height: 4px;
          margin: 10px auto 4px;
          border-radius: 999px;
          background: var(--border-color);
        }

        .save-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px 20px 14px;
          text-align: left;
        }

        .save-icon {
          width: 52px;
          height: 52px;
          flex: 0 0 52px;
          display: grid;
          place-items: center;
          border: 1px solid
            color-mix(
              in srgb,
              var(--accent-pink) 35%,
              transparent
            );
          border-radius: 16px;
          color: var(--accent-pink);
          background:
            color-mix(
              in srgb,
              var(--accent-pink) 10%,
              var(--surface-primary)
            );
        }

        .save-heading {
          min-width: 0;
        }

        .save-heading h2 {
          margin: 0;
          color: var(--text-primary);
          font-size: 20px;
          line-height: 1.3;
        }

        .save-heading p {
          margin: 4px 0 0;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.45;
        }

        .save-body {
          padding: 0 20px 18px;
        }

        .save-file-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          background: var(--surface-secondary);
        }

        .save-file-info {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
        }

        .save-file-info strong {
          overflow: hidden;
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1.4;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .save-file-info span {
          color: var(--text-muted);
          font-size: 13px;
          font-variant-numeric: tabular-nums;
        }

        .save-ready-badge {
          flex: 0 0 auto;
          padding: 5px 9px;
          border-radius: 999px;
          color: #166534;
          background: #dcfce7;
          font-size: 12px;
          font-weight: 700;
        }

        .save-tip {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 12px;
          padding: 12px;
          border-radius: 14px;
          color: var(--text-secondary);
          background:
            color-mix(
              in srgb,
              var(--accent-pink) 7%,
              var(--surface-secondary)
            );
          text-align: left;
        }

        .save-tip svg {
          flex: 0 0 auto;
          margin-top: 1px;
          color: var(--accent-pink);
        }

        .save-tip p {
          margin: 0;
          font-size: 13px;
          line-height: 1.55;
        }

        .save-error {
          margin-top: 12px;
          padding: 11px 12px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          color: #b91c1c;
          background: #fef2f2;
          font-size: 13px;
          text-align: left;
        }

        .save-actions {
          position: sticky;
          bottom: 0;
          display: grid;
          gap: 10px;
          padding:
            14px
            20px
            max(18px, env(safe-area-inset-bottom));
          border-top: 1px solid var(--border-color);
          background: var(--surface-primary);
        }

        .save-primary,
        .save-secondary {
          width: 100%;
          min-height: 48px;
          border-radius: 14px;
          font: inherit;
          font-weight: 700;
        }

        .save-primary {
          border: 0;
          color: white;
          background: var(--accent-pink);
        }

        .save-secondary {
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          background: transparent;
        }

        .save-primary:disabled,
        .save-secondary:disabled {
          cursor: wait;
          opacity: 0.6;
        }

        @media (min-width: 640px) {
          .save-overlay {
            align-items: center;
            padding: 24px;
          }

          .save-sheet {
            border-bottom: 1px solid var(--border-color);
            border-radius: 24px;
          }

          .save-sheet-handle {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .save-sheet {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
