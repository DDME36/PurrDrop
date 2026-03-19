// ICE Configuration
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export const RTC_CONFIG: RTCConfiguration = {
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export async function loadIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/ice-servers');
    const data = await res.json();
    console.log('✅ ICE servers loaded from API');
    return data.iceServers;
  } catch (err) {
    console.error('❌ Failed to load ICE servers:', err);
    return DEFAULT_ICE_SERVERS;
  }
}
