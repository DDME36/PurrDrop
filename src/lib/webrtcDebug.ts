/**
 * WebRTC Debug Utilities
 * Help diagnose connection issues
 */

export async function diagnoseConnection(pc: RTCPeerConnection): Promise<void> {
  console.group('🔍 WebRTC Connection Diagnosis');
  
  console.log('Connection State:', pc.connectionState);
  console.log('ICE Connection State:', pc.iceConnectionState);
  console.log('ICE Gathering State:', pc.iceGatheringState);
  console.log('Signaling State:', pc.signalingState);
  
  try {
    const stats = await pc.getStats();
    
    // Analyze ICE candidates
    const candidates: any[] = [];
    const candidatePairs: any[] = [];
    
    stats.forEach(report => {
      if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
        candidates.push({
          type: report.type,
          candidateType: report.candidateType,
          protocol: report.protocol,
          address: report.address,
          port: report.port,
        });
      }
      
      if (report.type === 'candidate-pair') {
        candidatePairs.push({
          state: report.state,
          nominated: report.nominated,
          bytesSent: report.bytesSent,
          bytesReceived: report.bytesReceived,
        });
      }
    });
    
    console.log('📊 ICE Candidates:', candidates);
    console.log('📊 Candidate Pairs:', candidatePairs);
    
    // Check if any pair succeeded
    const hasSucceeded = candidatePairs.some(pair => pair.state === 'succeeded');
    if (!hasSucceeded) {
      console.error('❌ No successful candidate pairs found!');
      console.log('💡 Possible issues:');
      console.log('  - Firewall blocking WebRTC');
      console.log('  - Symmetric NAT (need TURN server)');
      console.log('  - STUN server unreachable');
    }
    
  } catch (err) {
    console.error('Failed to get stats:', err);
  }
  
  console.groupEnd();
}

export function logIceCandidate(candidate: RTCIceCandidate): void {
  if (!candidate) return;
  
  const parts = candidate.candidate.split(' ');
  const type = parts[7]; // host, srflx, or relay
  const protocol = parts[2]; // udp or tcp
  
  console.log(`🧊 ICE Candidate: ${type} (${protocol})`);
}

export function getConnectionQuality(pc: RTCPeerConnection): Promise<string> {
  return pc.getStats().then(stats => {
    let quality = 'unknown';
    
    stats.forEach(report => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        const rtt = report.currentRoundTripTime;
        
        if (rtt < 0.05) quality = 'excellent';
        else if (rtt < 0.1) quality = 'good';
        else if (rtt < 0.2) quality = 'fair';
        else quality = 'poor';
      }
    });
    
    return quality;
  });
}
