import { NextResponse } from 'next/server';

// ICE Servers configuration - kept server-side for security
// TURN credentials are not exposed to client code
const ICE_SERVERS: RTCIceServer[] = [
  // Google STUN servers (fast, reliable)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },

  // OpenRelay Free TURN servers (no signup required)
  {
    urls: 'stun:stun.relay.metered.ca:80',
  },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: process.env.TURN_USERNAME || 'e7b4c5a0d1f2e3b4c5a6',
    credential: process.env.TURN_CREDENTIAL || 'zXcVbNmLkJhGfDsA',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: process.env.TURN_USERNAME || 'e7b4c5a0d1f2e3b4c5a6',
    credential: process.env.TURN_CREDENTIAL || 'zXcVbNmLkJhGfDsA',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: process.env.TURN_USERNAME || 'e7b4c5a0d1f2e3b4c5a6',
    credential: process.env.TURN_CREDENTIAL || 'zXcVbNmLkJhGfDsA',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: process.env.TURN_USERNAME || 'e7b4c5a0d1f2e3b4c5a6',
    credential: process.env.TURN_CREDENTIAL || 'zXcVbNmLkJhGfDsA',
  },
];

export async function GET() {
  return NextResponse.json({ iceServers: ICE_SERVERS });
}
