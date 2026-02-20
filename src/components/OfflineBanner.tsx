'use client';

import { useState, useEffect } from 'react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Show "back online" message briefly
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show banner if online and not recently reconnected
  if (isOnline && !showBanner) return null;

  return (
    <div className={`offline-banner ${isOnline ? 'online' : 'offline'}`}>
      <div className="offline-content">
        {isOnline ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>กลับมาออนไลน์แล้ว!</span>
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</span>
          </>
        )}
      </div>

      <style jsx>{`
        .offline-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
          animation: slideDown 0.3s ease-out;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .offline-banner.offline {
          background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
          color: white;
        }

        .offline-banner.online {
          background: linear-gradient(135deg, var(--accent-mint), #8fd9bf);
          color: white;
        }

        .offline-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 600px) {
          .offline-banner {
            font-size: 13px;
            padding: 10px 16px;
          }
        }
      `}</style>
    </div>
  );
}
