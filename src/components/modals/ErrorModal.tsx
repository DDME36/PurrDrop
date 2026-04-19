'use client';

import { AppError } from '@/lib/errorHandler';

interface ErrorModalProps {
  show: boolean;
  error: AppError | null;
  context?: string;
  onRetry?: () => void;
  onClose: () => void;
}

export function ErrorModal({ show, error, context, onRetry, onClose }: ErrorModalProps) {
  if (!show || !error) return null;

  const errorIcons = {
    network: '📡',
    webrtc: '🔗',
    relay: '🔄',
    connection: '⚠️',
    file: '📁',
    permission: '🔒',
    timeout: '⏱️',
    unknown: '❓',
  };

  const errorColors = {
    network: '#ff6b6b',
    webrtc: '#fbbf24',
    relay: '#60a5fa',
    connection: '#f59e0b',
    file: '#8b5cf6',
    permission: '#ef4444',
    timeout: '#f97316',
    unknown: '#6b7280',
  };

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content modal-error" onClick={e => e.stopPropagation()}>
        {/* Error Icon */}
        <div 
          className="error-modal-icon"
          style={{ 
            background: `linear-gradient(135deg, ${errorColors[error.type]}, ${errorColors[error.type]}dd)` 
          }}
        >
          <span className="error-emoji">{errorIcons[error.type]}</span>
        </div>

        {/* Error Title */}
        <div className="modal-title error-title">
          {error.userMessage}
        </div>

        {/* Error Type Badge */}
        <div className="error-type-badge" style={{ background: errorColors[error.type] }}>
          {error.type.toUpperCase()}
        </div>

        {/* Suggested Action */}
        {error.suggestedAction && (
          <div className="error-suggestion">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            <span>{error.suggestedAction}</span>
          </div>
        )}

        {/* Context (if provided) */}
        {context && (
          <div className="error-context">
            <strong>บริบท:</strong> {context}
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          {error.canRetry && onRetry && (
            <button className="btn btn-primary" onClick={onRetry}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6"/>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/>
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              ลองใหม่
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            ปิด
          </button>
        </div>

        {/* Dev Mode: Show technical details */}
        {process.env.NODE_ENV === 'development' && (
          <details className="error-details">
            <summary>รายละเอียดทางเทคนิค (Dev Mode)</summary>
            <pre>{JSON.stringify({
              type: error.type,
              message: error.message,
              canRetry: error.canRetry,
              originalError: error.originalError instanceof Error 
                ? error.originalError.message 
                : String(error.originalError)
            }, null, 2)}</pre>
          </details>
        )}
      </div>

      <style jsx>{`
        .modal-error {
          max-width: 400px;
        }

        .error-modal-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          animation: errorPulse 2s ease-in-out infinite;
        }

        .error-emoji {
          font-size: 40px;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
        }

        @keyframes errorPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .error-title {
          color: var(--text-primary);
          margin-bottom: 12px;
        }

        .error-type-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          letter-spacing: 0.5px;
          margin-bottom: 16px;
        }

        .error-suggestion {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        .error-suggestion svg {
          flex-shrink: 0;
          stroke: #3b82f6;
        }

        .error-context {
          font-size: 13px;
          color: var(--text-muted);
          padding: 10px;
          background: rgba(0, 0, 0, 0.03);
          border-radius: 8px;
          margin-bottom: 16px;
          text-align: left;
        }

        .error-context strong {
          color: var(--text-secondary);
        }

        .error-details {
          margin-top: 16px;
          text-align: left;
        }

        .error-details summary {
          cursor: pointer;
          font-size: 12px;
          color: var(--text-muted);
          padding: 8px;
          background: rgba(0, 0, 0, 0.03);
          border-radius: 8px;
          user-select: none;
        }

        .error-details summary:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        .error-details pre {
          margin-top: 8px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          font-size: 11px;
          overflow-x: auto;
          color: var(--text-secondary);
        }

        [data-theme="dark"] .error-suggestion {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.3);
        }

        [data-theme="dark"] .error-context {
          background: rgba(255, 255, 255, 0.05);
        }

        [data-theme="dark"] .error-details summary {
          background: rgba(255, 255, 255, 0.05);
        }

        [data-theme="dark"] .error-details summary:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        [data-theme="dark"] .error-details pre {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
