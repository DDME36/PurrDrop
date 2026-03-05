import { NextResponse } from 'next/server';

// ICE Servers configuration - kept server-side for security
// TURN credentials loaded from environment variables only
const getIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    // Google STUN servers (fast, reliable, free)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  // Only add TURN servers if credentials are configured
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUsername && turnCredential) {
    servers.push(
      { urls: 'stun:stun.relay.metered.ca:80' },
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: 'turn:global.relay.metered.ca:80?transport=tcp',
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: 'turn:global.relay.metered.ca:443',
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: 'turns:global.relay.metered.ca:443?transport=tcp',
        username: turnUsername,
        credential: turnCredential,
      },
    );
  }

  return servers;
};

export async function GET() {
  return NextResponse.json({ iceServers: getIceServers() });
}
