// Network Quality Detection
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor';

interface NetworkStats {
  rtt: number; // Round-trip time in ms
  downlink: number; // Mbps
  effectiveType: string;
}

/**
 * Detect network quality by measuring RTT to server
 */
export async function detectNetworkQuality(): Promise<NetworkQuality> {
  try {
    const startTime = Date.now();
    const response = await fetch('/health', { 
      method: 'HEAD',
      cache: 'no-cache',
    });
    
    if (!response.ok) throw new Error('Health check failed');
    
    const rtt = Date.now() - startTime;
    
    // Classify based on RTT
    if (rtt < 50) return 'excellent';
    if (rtt < 150) return 'good';
    if (rtt < 300) return 'fair';
    return 'poor';
  } catch (err) {
    console.error('Network quality detection failed:', err);
    return 'poor';
  }
}

/**
 * Get network stats from browser API
 */
export function getNetworkStats(): NetworkStats | null {
  const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
  
  if (!connection) return null;
  
  return {
    rtt: connection.rtt || 0,
    downlink: connection.downlink || 0,
    effectiveType: connection.effectiveType || 'unknown',
  };
}

/**
 * Determine if should use P2P based on network quality
 */
export function shouldUseP2PBasedOnQuality(quality: NetworkQuality): boolean {
  // P2P requires good network
  return quality === 'excellent' || quality === 'good';
}

/**
 * Get recommended transfer method based on network
 */
export function getRecommendedTransferMethod(
  quality: NetworkQuality,
  fileSize: number
): 'p2p' | 'relay' | 'hybrid' {
  // Small files - always try P2P
  if (fileSize < 5 * 1024 * 1024) {
    return 'p2p';
  }
  
  // Large files - depends on quality
  if (fileSize > 50 * 1024 * 1024) {
    if (quality === 'excellent') return 'p2p';
    if (quality === 'good') return 'hybrid'; // Try P2P, fallback to relay
    return 'relay';
  }
  
  // Medium files
  if (quality === 'excellent' || quality === 'good') return 'p2p';
  if (quality === 'fair') return 'hybrid';
  return 'relay';
}

/**
 * Monitor network quality changes
 */
export function monitorNetworkQuality(
  onQualityChange: (quality: NetworkQuality) => void
): () => void {
  let currentQuality: NetworkQuality = 'good';
  let intervalId: NodeJS.Timeout;
  
  const checkQuality = async () => {
    const quality = await detectNetworkQuality();
    if (quality !== currentQuality) {
      currentQuality = quality;
      onQualityChange(quality);
    }
  };
  
  // Check every 30 seconds
  intervalId = setInterval(checkQuality, 30000);
  
  // Initial check
  checkQuality();
  
  // Listen to connection changes
  const connection = (navigator as any).connection;
  if (connection) {
    connection.addEventListener('change', checkQuality);
  }
  
  // Cleanup function
  return () => {
    clearInterval(intervalId);
    if (connection) {
      connection.removeEventListener('change', checkQuality);
    }
  };
}

/**
 * Get network quality indicator color
 */
export function getQualityColor(quality: NetworkQuality): string {
  const colors = {
    excellent: '#10b981',
    good: '#3b82f6',
    fair: '#f59e0b',
    poor: '#ef4444',
  };
  return colors[quality];
}

/**
 * Get network quality label
 */
export function getQualityLabel(quality: NetworkQuality): string {
  const labels = {
    excellent: 'ยอดเยี่ยม',
    good: 'ดี',
    fair: 'พอใช้',
    poor: 'อ่อน',
  };
  return labels[quality];
}

/**
 * Estimate transfer time based on network quality
 */
export function estimateTransferTime(
  fileSize: number,
  quality: NetworkQuality,
  method: 'p2p' | 'relay'
): number {
  // Speed estimates in MB/s
  const speeds = {
    p2p: {
      excellent: 10,
      good: 5,
      fair: 2,
      poor: 0.5,
    },
    relay: {
      excellent: 3,
      good: 2,
      fair: 1,
      poor: 0.3,
    },
  };
  
  const speedMBps = speeds[method][quality];
  const fileSizeMB = fileSize / (1024 * 1024);
  
  return Math.ceil(fileSizeMB / speedMBps); // seconds
}
