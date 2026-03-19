'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log critical error
    console.error('Critical application error:', error);
  }, [error]);

  return (
    <html lang="th">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'linear-gradient(180deg, #fffaf0 0%, #fdf3ff 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderRadius: '24px',
            padding: '48px 32px',
            boxShadow: '0 8px 32px rgba(180, 160, 150, 0.15)',
          }}>
            <div style={{
              fontSize: '80px',
              marginBottom: '24px',
            }}>
              🙀
            </div>
            
            <h1 style={{
              fontSize: '28px',
              fontWeight: '600',
              color: '#5a4a42',
              marginBottom: '12px',
            }}>
              เกิดข้อผิดพลาดร้ายแรง
            </h1>
            
            <p style={{
              fontSize: '16px',
              color: '#8b7b73',
              marginBottom: '32px',
              lineHeight: '1.6',
            }}>
              แอปพลิเคชันเจอปัญหาที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง
            </p>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              <button
                onClick={reset}
                style={{
                  padding: '12px 24px',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ffb3d1, #ffd3b6)',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(255, 179, 209, 0.4)',
                }}
              >
                ลองใหม่อีกครั้ง
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '12px 24px',
                  borderRadius: '16px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.05)',
                  color: '#5a4a42',
                }}
              >
                โหลดหน้าใหม่
              </button>
            </div>

            <p style={{
              fontSize: '14px',
              color: '#b5a89f',
              marginTop: '24px',
              lineHeight: '1.6',
            }}>
              💡 ลองล้าง Cache หรือใช้ Incognito Mode
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
