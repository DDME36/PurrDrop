'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-emoji">😿</div>
        <h1 className="error-title">อุ๊ปส์! มีบางอย่างผิดพลาด</h1>
        <p className="error-message">
          แมวน้อยของเราเจอปัญหานิดหน่อย
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="error-details">
            <summary>รายละเอียดข้อผิดพลาด (Dev Mode)</summary>
            <pre>{error.message}</pre>
          </details>
        )}

        <div className="error-actions">
          <button
            onClick={reset}
            className="error-btn primary"
          >
            ลองใหม่อีกครั้ง
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="error-btn secondary"
          >
            กลับหน้าหลัก
          </button>
        </div>

        <p className="error-hint">
          💡 ถ้าปัญหายังไม่หาย ลองรีเฟรชหน้าเว็บ หรือล้าง Cache
        </p>
      </div>

      <style jsx>{`
        .error-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: linear-gradient(
            180deg,
            var(--bg-cream, #fffaf0) 0%,
            var(--bg-gradient-end, #fdf3ff) 100%
          );
        }

        .error-container {
          max-width: 500px;
          width: 100%;
          text-align: center;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(12px);
          border-radius: 24px;
          padding: 48px 32px;
          box-shadow: 0 8px 32px rgba(180, 160, 150, 0.15);
        }

        .error-emoji {
          font-size: 80px;
          margin-bottom: 24px;
          animation: bounce 2s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        .error-title {
          font-family: var(--font-display, 'Mitr', sans-serif);
          font-size: 28px;
          font-weight: 600;
          color: var(--text-primary, #5a4a42);
          margin-bottom: 12px;
        }

        .error-message {
          font-size: 16px;
          color: var(--text-secondary, #8b7b73);
          margin-bottom: 32px;
          line-height: 1.6;
        }

        .error-details {
          text-align: left;
          margin: 24px 0;
          padding: 16px;
          background: rgba(255, 107, 107, 0.1);
          border-radius: 12px;
          border: 1px solid rgba(255, 107, 107, 0.3);
        }

        .error-details summary {
          cursor: pointer;
          font-weight: 600;
          color: #ff6b6b;
          margin-bottom: 8px;
        }

        .error-details pre {
          margin-top: 12px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          overflow-x: auto;
          font-size: 12px;
          color: #333;
        }

        .error-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 24px;
        }

        .error-btn {
          padding: 12px 24px;
          border-radius: 16px;
          font-family: var(--font-body, 'IBM Plex Sans Thai', sans-serif);
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
        }

        .error-btn.primary {
          background: linear-gradient(135deg, var(--accent-pink, #ffb3d1), var(--accent-peach, #ffd3b6));
          color: white;
          box-shadow: 0 4px 12px rgba(255, 179, 209, 0.4);
        }

        .error-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(255, 179, 209, 0.6);
        }

        .error-btn.secondary {
          background: rgba(0, 0, 0, 0.05);
          color: var(--text-primary, #5a4a42);
        }

        .error-btn.secondary:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        .error-hint {
          font-size: 14px;
          color: var(--text-muted, #b5a89f);
          line-height: 1.6;
        }

        @media (max-width: 600px) {
          .error-container {
            padding: 32px 24px;
          }

          .error-emoji {
            font-size: 64px;
          }

          .error-title {
            font-size: 24px;
          }

          .error-actions {
            flex-direction: column;
          }

          .error-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
