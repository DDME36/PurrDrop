// Input sanitization utilities for server-side validation

const MAX_NAME_LENGTH = 50;
const MAX_ROOM_CODE_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 100;

// Sanitize user name - remove HTML tags and limit length
export function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return 'Anonymous';
  
  // Remove HTML tags and trim
  const cleaned = name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"]/g, '')
    .trim();
  
  // Limit length
  const truncated = cleaned.slice(0, MAX_NAME_LENGTH);
  
  return truncated || 'Anonymous';
}

// Validate room code - must be 5 digits
export function validateRoomCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  
  const cleaned = code.trim();
  
  // Must be exactly 5 digits
  if (!/^\d{5}$/.test(cleaned)) return null;
  
  return cleaned;
}

// Sanitize password
export function sanitizePassword(password: unknown): string | null {
  if (typeof password !== 'string') return null;
  
  const cleaned = password.trim();
  
  // Limit length
  if (cleaned.length > MAX_PASSWORD_LENGTH) return null;
  
  return cleaned || null;
}

// Validate peer data structure
export interface ValidatedPeerData {
  id: string;
  name: string;
  device: string;
  critter: {
    type: string;
    color: string;
    emoji: string;
    os: string;
  };
}

export function validatePeerData(data: unknown): ValidatedPeerData | null {
  if (!data || typeof data !== 'object') return null;
  
  const peer = data as Record<string, unknown>;
  
  // Validate required fields
  if (typeof peer.id !== 'string' || !peer.id.trim()) return null;
  if (typeof peer.device !== 'string') return null;
  if (!peer.critter || typeof peer.critter !== 'object') return null;
  
  const critter = peer.critter as Record<string, unknown>;
  if (typeof critter.type !== 'string') return null;
  if (typeof critter.color !== 'string') return null;
  if (typeof critter.emoji !== 'string') return null;
  if (typeof critter.os !== 'string') return null;
  
  return {
    id: peer.id.trim().slice(0, 50),
    name: sanitizeName(peer.name),
    device: peer.device.slice(0, 100),
    critter: {
      type: critter.type.slice(0, 50),
      color: critter.color.slice(0, 50),
      emoji: critter.emoji.slice(0, 10),
      os: critter.os.slice(0, 50),
    },
  };
}
