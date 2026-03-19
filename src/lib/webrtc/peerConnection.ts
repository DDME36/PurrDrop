// PeerConnection Management
import { RTC_CONFIG, DEFAULT_ICE_SERVERS } from './iceConfig';

export function createPeerConnection(
  peerId: string,
  iceServers: RTCIceServer[],
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onDataChannel: (channel: RTCDataChannel) => void,
  onConnectionStateChange: (state: RTCIceConnectionState) => void
): RTCPeerConnection {
  console.log(`🔗 Creating PeerConnection for ${peerId}`);

  const pc = new RTCPeerConnection({
    ...RTC_CONFIG,
    iceServers: iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS,
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      console.log('🧊 Sending ICE candidate:', e.candidate.type);
      onIceCandidate(e.candidate);
    } else {
      console.log('🧊 ICE gathering complete');
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log(`🧊 ICE gathering state: ${pc.iceGatheringState}`);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`🧊 ICE connection state: ${pc.iceConnectionState}`);
    onConnectionStateChange(pc.iceConnectionState);

    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      logConnectionType(pc);
    }

    if (pc.iceConnectionState === 'failed') {
      console.error('❌ ICE connection failed - attempting ICE restart');
      pc.getStats().then(stats => {
        console.log('📊 Connection stats:', Array.from(stats.values()));
      });
      try {
        pc.restartIce();
        console.log('🔄 ICE restart triggered');
      } catch (err) {
        console.error('❌ ICE restart failed:', err);
      }
    }
  };

  pc.ondatachannel = (e) => {
    console.log(`📥 Received DataChannel from ${peerId}`);
    onDataChannel(e.channel);
  };

  return pc;
}

async function logConnectionType(pc: RTCPeerConnection): Promise<void> {
  const stats = await pc.getStats();
  stats.forEach(report => {
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      const localCandidate = stats.get(report.localCandidateId);
      const remoteCandidate = stats.get(report.remoteCandidateId);

      const localType = localCandidate?.candidateType || 'unknown';
      const remoteType = remoteCandidate?.candidateType || 'unknown';

      let connectionType: 'direct' | 'stun' | 'relay' = 'direct';

      if (localType === 'relay' || remoteType === 'relay') {
        console.log('🔄 Connection via TURN relay (fallback)');
        connectionType = 'relay';
      } else if (localType === 'srflx' || remoteType === 'srflx') {
        console.log('✅ Connection via STUN (server reflexive)');
        connectionType = 'stun';
      } else {
        console.log('⚡ Direct P2P connection (host)');
        connectionType = 'direct';
      }
      console.log(`📡 Local: ${localType}, Remote: ${remoteType}`);
    }
  });
}

export async function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number = 3000): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return;
  }

  console.log('⏳ Waiting for ICE gathering...');
  
  return new Promise<void>((resolve) => {
    const checkGathering = () => {
      console.log('🧊 ICE gathering state:', pc.iceGatheringState);
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', checkGathering);
        console.log('✅ ICE gathering complete');
        resolve();
      }
    };
    
    pc.addEventListener('icegatheringstatechange', checkGathering);
    
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', checkGathering);
      console.log('⏱️ ICE gathering timeout, continuing anyway');
      resolve();
    }, timeoutMs);
  });
}
