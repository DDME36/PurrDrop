'use client';

import { useState, useEffect } from 'react';

export function BrowserWarning() {
  const [showWarning, setShowWarning] = useState<'inapp' | 'duplicate' | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setCurrentUrl(window.location.href);

    // Detect In-App Browser
    const ua = navigator.userAgent || navigator.vendor;
    const isInAppBrowser = 
      /FBAN|FBAV|Instagram|Line|Twitter|LinkedIn|Snapchat|Pinterest|TikTok/i.test(ua) ||
      // iOS In-App Browser detection
      (/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua)) ||
      // Generic WebView detection
      /wv|WebView/i.test(ua);

    if (isInAppBrowser) {
      setShowWarning('inapp');
      return;
    }

    // Detect duplicate tabs using BroadcastChannel
    const channel = new BroadcastChannel('purrdrop_session');
    const sessionId = Date.now().toString();
    
    channel.onmessage = (event) => {
      if (event.data.type === 'ping' && event.data.id !== sessionId) {
        // Another tab is active
        setShowWarning('duplicate');
      }
      if (event.data.type === 'pong' && event.data.id !== sessionId) {
        // Response from another tab
        setShowWarning('duplicate');
      }
    };

    // Announce this tab
    channel.postMessage({ type: 'ping', id: sessionId });

    // Listen for new tabs
    const interval = setInterval(() => {
      channel.postMessage({ type: 'ping', id: sessionId });
    }, 5000);

    // Respond to pings
    channel.addEventListener('message', (event) => {
      if (event.data.type === 'ping' && event.data.id !== sessionId) {
        channel.postMessage({ type: 'pong', id: sessionId });
      }
    });

    return () => {
      clearInterval(interval);
      channel.close();
    };
  }, []);

  const handleOpenInBrowser = () => {
    // Try to open in default browser
    const url = window.location.href;
    
    // For iOS, try to open in Safari
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = `x-safari-${url}`;
      // Fallback: show copy instruction
      setTimeout(() => {
        alert('กรุณาคัดลอก URL และเปิดใน Safari:\n' + url);
      }, 500);
    } else {
      // For Android, try intent
      window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      alert('คัดลอก URL แล้ว! กรุณาเปิดใน Safari หรือ Chrome');
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('คัดลอก URL แล้ว! กรุณาเปิดใน Safari หรือ Chrome');
    }
  };

  if (!showWarning) return null;

  return (
    <div className="browser-warning-overlay">
      <div className="browser-warning-card">
        {showWarning === 'inapp' ? (
          <>
            <div className="warning-icon">🌐</div>
            <h2 className="warning-title">เปิดใน Browser หลัก</h2>
            <p className="warning-text">
              PurrDrop ทำงานได้ดีที่สุดใน Safari หรือ Chrome
              <br />
              In-App Browser ไม่รองรับการดาวน์โหลดไฟล์
            </p>
            <div className="warning-url">{currentUrl}</div>
            <div className="warning-actions">
              <button className="btn btn-accept" onClick={handleCopyUrl}>
                📋 คัดลอก URL
              </button>
              <button className="btn btn-reject" onClick={handleOpenInBrowser}>
                🚀 เปิดใน Browser
              </button>
            </div>
            <p className="warning-hint">
              💡 กดปุ่ม ⋯ หรือ Share แล้วเลือก "Open in Safari/Chrome"
            </p>
          </>
        ) : (
          <>
            <div className="warning-icon">⚠️</div>
            <h2 className="warning-title">เปิดหลายหน้าต่าง</h2>
            <p className="warning-text">
              ตรวจพบว่า PurrDrop เปิดอยู่หลายแท็บ
              <br />
              กรุณาปิดแท็บอื่นเพื่อป้องกันปัญหา
            </p>
            <div className="warning-actions">
              <button className="btn btn-accept" onClick={() => setShowWarning(null)}>
                ✓ เข้าใจแล้ว ใช้แท็บนี้
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
