// Enhanced Device Detection
export function detectDevice() {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  
  // Improved iOS/iPadOS detection
  const isIOS = /iPad|iPhone|iPod/.test(ua) || 
                (platform === 'MacIntel' && maxTouchPoints > 1);
  
  return {
    isIOS,
    isAndroid: /Android/.test(ua),
    isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
    isChrome: /Chrome/.test(ua),
    isFirefox: /Firefox/.test(ua),
    isMobile: /Mobile|Android|iPhone|iPad|iPod/.test(ua),
    isDesktop: !/Mobile|Android|iPhone|iPad|iPod/.test(ua),
    
    // WebRTC support detection
    supportsWebRTC: !!(window.RTCPeerConnection || (window as any).webkitRTCPeerConnection),
    supportsDataChannel: typeof RTCDataChannel !== 'undefined',
    
    // Feature detection
    supportsWakeLock: 'wakeLock' in navigator,
    supportsNotifications: 'Notification' in window,
    supportsServiceWorker: 'serviceWorker' in navigator,
    
    // Network info
    isOnline: navigator.onLine,
    connectionType: (navigator as any).connection?.effectiveType || 'unknown',
  };
}

export function shouldUseRelay(discoveryMode?: string, fileSize?: number): boolean {
  const device = detectDevice();
  
  // iOS Safari: WebRTC ดีขึ้นมากใน iOS 16+
  if (device.isIOS) {
    const iosVersion = getIOSVersion();
    
    // iOS 16+ และอยู่ WiFi เดียวกัน → ลอง P2P
    if (iosVersion >= 16 && discoveryMode === 'wifi') {
      // ไฟล์เล็ก (< 50MB) → ลอง P2P เสมอ
      if (fileSize && fileSize < 50 * 1024 * 1024) {
        console.log('📱 iOS 16+ WiFi mode + small file → trying P2P');
        return false;
      }
      // ไฟล์ใหญ่ → ลอง P2P แต่มี fallback
      console.log('📱 iOS 16+ WiFi mode → trying P2P with fallback');
      return false;
    }
    
    // iOS 15 หรือ network ต่างกัน → Relay
    console.log('📱 iOS 15 or different network → using Relay');
    return true;
  }

  // บราวเซอร์ที่ไม่รองรับ WebRTC
  if (!device.supportsWebRTC || !device.supportsDataChannel) return true;
  
  // Force relay for very slow connections
  if (device.connectionType === 'slow-2g' || device.connectionType === '2g') return true;
  
  return false;
}

function getIOSVersion(): number {
  const match = navigator.userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1]) : 0;
}

export function getRecommendedChunkSize(): number {
  const device = detectDevice();
  
  if (device.isIOS) return 16 * 1024; // 16KB for iOS
  if (device.isMobile) return 32 * 1024; // 32KB for mobile
  if (device.connectionType === '4g') return 256 * 1024; // 256KB for 4G
  
  return 64 * 1024; // 64KB default
}
