import { NextResponse } from 'next/server';

// ICE Servers configuration - kept server-side for security
// TURN credentials loaded from environment variables only
const getIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    // Google STUN servers (fast, reliable, free)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free public TURN servers (fallback)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];

  // Only add TURN servers if credentials are configured
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUsername && turnCredential) {
    // Metered.ca TURN servers (sign up at https://www.metered.ca/tools/openrelay/)
    servers.push(
      { urls: 'stun:stun.relay.metered.ca:80' },
      {
        urls: 'turn:standard.relay.metered.ca:80',
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: 'turn:standard.relay.metered.ca:443',
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
        username: turnUsername,
        credential: turnCredential,
      },
    );
  } else {
    console.log('⚠️ No TURN credentials configured. WebRTC may fail behind symmetric NAT.');
    console.log('   Get free TURN credentials at: https://www.metered.ca/tools/openrelay/');
  }

  return servers;
};

export async function GET() {
  return NextResponse.json({ iceServers: getIceServers() });
}

