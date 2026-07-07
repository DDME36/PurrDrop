// Wake Lock Management
let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<void> {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('🔒 Wake Lock acquired');
    } catch (err) {
      console.log('Wake Lock not available:', err);
    }
  }
}

export function releaseWakeLock(): void {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
    console.log('🔓 Wake Lock released');
  }
}
