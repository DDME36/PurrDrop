// Enhanced Device Detection
export function detectDevice() {
  const ua = navigator.userAgent;
  
  return {
    isIOS: /iPad|iPhone|iPod/.test(ua),
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

export function shouldUseRelay(): boolean {
  const device = detectDevice();
  
  // Force relay for iOS (WebRTC unreliable)
  if (device.isIOS) return true;
  
  // Force relay for old browsers without WebRTC
  if (!device.supportsWebRTC || !device.supportsDataChannel) return true;
  
  // Force relay for slow connections
  if (device.connectionType === 'slow-2g' || device.connectionType === '2g') return true;
  
  return false;
}

export function getRecommendedChunkSize(): number {
  const device = detectDevice();
  
  if (device.isIOS) return 16 * 1024; // 16KB for iOS
  if (device.isMobile) return 32 * 1024; // 32KB for mobile
  if (device.connectionType === '4g') return 256 * 1024; // 256KB for 4G
  
  return 64 * 1024; // 64KB default
}
