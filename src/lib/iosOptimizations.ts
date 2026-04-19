// iOS-Specific Optimizations
import { detectDevice } from './deviceDetection';

/**
 * Get iOS version from user agent
 */
export function getIOSVersion(): number {
  const match = navigator.userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Check if iOS version supports better WebRTC
 * iOS 16+ has significantly improved WebRTC support
 */
export function supportsModernWebRTC(): boolean {
  const device = detectDevice();
  if (!device.isIOS) return true; // Non-iOS always try P2P
  
  const version = getIOSVersion();
  return version >= 16;
}

/**
 * iOS-optimized download using Share API
 */
export async function downloadBlobIOS(
  blob: Blob, 
  filename: string,
  onError?: (error: string) => void
): Promise<boolean> {
  // Try Share API first (iOS native, best UX)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      
      // Check if can share files
      if (await navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'PurrDrop',
          text: `ไฟล์: ${filename}`,
        });
        return true;
      }
    } catch (err) {
      // User cancelled or share failed
      console.log('Share API failed:', err);
    }
  }
  
  // Fallback: Try Files App (iOS 15.2+)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'All Files',
          accept: { '*/*': [] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      console.log('Files App save failed:', err);
    }
  }
  
  // Last resort: Open in new tab
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url, '_blank');
  
  if (!newWindow) {
    // Popup blocked - show instructions
    onError?.('popup-blocked');
    return false;
  }
  
  // Clean up after 30 seconds
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}

/**
 * Show download instructions modal for iOS
 */
export function showIOSDownloadInstructions(filename: string): string {
  return `
📥 วิธีดาวน์โหลดไฟล์บน iOS:

1. กดปุ่ม "อนุญาต" เมื่อมี popup
2. หรือ Long press ลิงก์ → เลือก "Download Linked File"
3. ไฟล์จะถูกบันทึกใน Files app

ชื่อไฟล์: ${filename}
  `.trim();
}

/**
 * iOS-optimized chunk size
 * iOS Safari has smaller buffer limits
 */
export function getIOSChunkSize(fileSize: number): number {
  const version = getIOSVersion();
  
  // iOS 16+ can handle larger chunks
  if (version >= 16) {
    if (fileSize < 10 * 1024 * 1024) return 32 * 1024; // 32KB for small files
    return 64 * 1024; // 64KB for large files
  }
  
  // iOS 15 and below - use smaller chunks
  return 16 * 1024; // 16KB
}

/**
 * Check if should try P2P on iOS
 */
export function shouldTryP2POnIOS(
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor',
  fileSize: number
): boolean {
  const version = getIOSVersion();
  
  // iOS 15 and below - always use relay (too unstable)
  if (version < 16) return false;
  
  // iOS 16+ - try P2P with conditions
  if (version >= 16) {
    // Small files - always try P2P
    if (fileSize < 10 * 1024 * 1024) return true;
    
    // Large files - only if network is good
    if (networkQuality === 'excellent' || networkQuality === 'good') {
      return true;
    }
  }
  
  return false;
}

/**
 * iOS-specific RTCConfiguration
 */
export function getIOSRTCConfiguration(iceServers: RTCIceServer[]): RTCConfiguration {
  const version = getIOSVersion();
  
  const baseConfig: RTCConfiguration = {
    iceServers,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
  
  if (version >= 16) {
    return {
      ...baseConfig,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all', // Try all candidates
    };
  }
  
  // iOS 15 and below - more conservative
  return {
    ...baseConfig,
    iceCandidatePoolSize: 5,
    iceTransportPolicy: 'all',
  };
}

/**
 * Detect if on same network (for WiFi mode)
 */
export function isOnSameNetwork(myIP: string, peerIP: string): boolean {
  // Simple subnet check (first 3 octets)
  const mySubnet = myIP.split('.').slice(0, 3).join('.');
  const peerSubnet = peerIP.split('.').slice(0, 3).join('.');
  return mySubnet === peerSubnet;
}

/**
 * iOS haptic feedback
 */
export function triggerIOSHaptic(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!detectDevice().isIOS) return;
  
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30],
    };
    navigator.vibrate(patterns[type]);
  }
}

/**
 * Check iOS Safari version
 */
export function getSafariVersion(): number {
  const match = navigator.userAgent.match(/Version\/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * iOS-specific feature detection
 */
export function getIOSFeatures() {
  const version = getIOSVersion();
  const safariVersion = getSafariVersion();
  
  return {
    version,
    safariVersion,
    supportsWebRTC: version >= 14,
    supportsModernWebRTC: version >= 16,
    supportsShareAPI: 'share' in navigator,
    supportsFilesAPI: 'showSaveFilePicker' in window,
    supportsWakeLock: 'wakeLock' in navigator,
    supportsNotifications: 'Notification' in window && Notification.permission !== 'denied',
    supportsPWA: 'standalone' in navigator,
    supportsHaptics: 'vibrate' in navigator,
  };
}
