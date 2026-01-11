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
    
    // Check for common In-App browsers
    const isCommonInApp = /FBAN|FBAV|Instagram|Line|Twitter|LinkedIn|Snapchat|Pinterest|TikTok/i.test(ua);
    
    // iOS In-App Browser detection (WebKit without Safari)
    const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua);
    
    // Generic WebView detection
    const isWebView = /wv|WebView/i.test(ua);
    
    // Check referrer for social apps
    const fromSocialApp = document.referrer && 
      (document.referrer.includes('instagram') || 
       document.referrer.includes('facebook') || 
       document.referrer.includes('line.me') ||
       document.referrer.includes('twitter') ||
       document.referrer.includes('tiktok'));

    const isInAppBrowser = isCommonInApp || isIOSWebView || isWebView || fromSocialApp;

    if (isInAppBrowser) {
      setShowWarning('inapp');
      // Prevent socket connection by setting a flag
      sessionStorage.setItem('purrdrop_inapp', 'true');
      return;
    }

    // Clear the flag if not in-app
    sessionStorage.removeItem('purrdrop_inapp');

    // Detect duplicate tabs using BroadcastChannel
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('purrdrop_session');
      const sessionId = Date.now().toString();
      let duplicateDetected = false;
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'ping' && event.data.id !== sessionId) {
          // Another tab is active - respond
          channel.postMessage({ type: 'pong', id: sessionId });
          if (!duplicateDetected) {
            duplicateDetected = true;
            setShowWarning('duplicate');
          }
        }
        if (event.data.type === 'pong' && event.data.id !== sessionId) {
          // Response from another tab
          if (!duplicateDetected) {
            duplicateDetected = true;
            setShowWarning('duplicate');
          }
        }
      };

      channel.onmessage = handleMessage;

      // Announce this tab
      channel.postMessage({ type: 'ping', id: sessionId });

      // Periodic check for new tabs
      const interval = setInterval(() => {
        channel.postMessage({ type: 'ping', id: sessionId });
      }, 3000);

      return () => {
        clearInterval(interval);
        channel.close();
      };
    }
  }, []);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      alert('คัดลอก URL แล้ว!\n\n1. เปิด Safari หรือ Chrome\n2. วาง URL ในช่อง address\n3. กด Enter');
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('คัดลอก URL แล้ว!\n\n1. เปิด Safari หรือ Chrome\n2. วาง URL ในช่อง address\n3. กด Enter');
    }
  };

  const handleCloseTab = () => {
    window.close();
    // If window.close() doesn't work (most browsers block it)
    setTimeout(() => {
      setShowWarning(null);
    }, 500);
  };

  if (!showWarning) return null;

  return (
    <div className="browser-warning-overlay">
      <div className="browser-warning-card">
        {showWarning === 'inapp' ? (
          <>
            <div className="warning-icon">🌐</div>
            <h2 className="warning-title">เปิดใน Safari / Chrome</h2>
            <p className="warning-text">
              คุณกำลังใช้ In-App Browser ซึ่งไม่รองรับการส่งไฟล์
              <br /><br />
              กรุณาคัดลอก URL แล้วเปิดใน Safari หรือ Chrome
            </p>
            <div className="warning-url">{currentUrl}</div>
            <div className="warning-actions">
              <button className="btn btn-accept" onClick={handleCopyUrl}>
                📋 คัดลอก URL
              </button>
            </div>
            <p className="warning-hint">
              💡 หรือกดปุ่ม <strong>⋯</strong> ด้านบน แล้วเลือก <strong>"Open in Safari"</strong> หรือ <strong>"Open in Chrome"</strong>
            </p>
          </>
        ) : (
          <>
            <div className="warning-icon">⚠️</div>
            <h2 className="warning-title">เปิดหลายหน้าต่าง</h2>
            <p className="warning-text">
              PurrDrop เปิดอยู่หลายแท็บ/หน้าต่าง
              <br />
              อาจทำให้เกิดปัญหาในการส่งไฟล์
              <br /><br />
              กรุณาปิดแท็บอื่นแล้วใช้แท็บนี้แท็บเดียว
            </p>
            <div className="warning-actions">
              <button className="btn btn-reject" onClick={handleCloseTab}>
                ✕ ปิดแท็บนี้
              </button>
              <button className="btn btn-accept" onClick={() => setShowWarning(null)}>
                ✓ ใช้แท็บนี้
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
