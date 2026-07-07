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
    supportsWebRTC: !!(window.RTCPeerConnection || (window as Window & { webkitRTCPeerConnection?: typeof RTCPeerConnection }).webkitRTCPeerConnection),
    supportsDataChannel: typeof RTCDataChannel !== 'undefined',
    
    // Feature detection
    supportsWakeLock: 'wakeLock' in navigator,
    supportsNotifications: 'Notification' in window,
    supportsServiceWorker: 'serviceWorker' in navigator,
    
    // Network info
    isOnline: navigator.onLine,
    connectionType: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType || 'unknown',
  };
}

export function shouldUseRelay(discoveryMode?: string, fileSize?: number): boolean {
  const device = detectDevice();

  if (!device.supportsWebRTC || !device.supportsDataChannel) return true;

  if (device.isIOS) {
    const iosVersion = getIOSVersion();
    if (iosVersion > 0 && iosVersion < 16) {
      console.log('📱 Older iOS detected → using Relay');
      return true;
    }

    console.log(`📱 Modern iOS ${discoveryMode || 'public'} mode → trying P2P first with relay fallback`);
    return false;
  }

  if (device.connectionType === 'slow-2g' || device.connectionType === '2g') {
    console.log('⚠️ Very slow network reported → still trying P2P first to avoid server relay load');
  }

  if (fileSize && fileSize > 150 * 1024 * 1024 && discoveryMode !== 'wifi') {
    console.log('📦 Large file outside WiFi mode → trying P2P first; relay remains fallback');
  }

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

