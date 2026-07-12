// Critter definitions based on device OS
export const CRITTERS = {
  ios: { type: 'cat', color: '#ffd3b6', emoji: '🐱', name: 'Shuba' },
  macos: { type: 'cat', color: '#ffd3b6', emoji: '🐱', name: 'Shuba' },
  ipados: { type: 'hedgehog', color: '#c7ceea', emoji: '🦔', name: 'Spike' },
  windows: { type: 'panda', color: '#ffb3d1', emoji: '🐼', name: 'Mochi' },
  android: { type: 'rabbit', color: '#a8e6cf', emoji: '🐰', name: 'Loppy' },
  linux: { type: 'owl', color: '#c7ceea', emoji: '🦉', name: 'Hoot' },
  unknown: { type: 'fox', color: '#ffd3b6', emoji: '🦊', name: 'Foxy' },
} as const;

export type OSType = keyof typeof CRITTERS;

export interface CritterInfo {
  type: string;
  color: string;
  emoji: string;
  os: OSType;
}

export interface Peer {
  id: string;
  tabId?: string;
  name: string;
  device: string;
  critter: CritterInfo;
}

// Cute random names
const ADJECTIVES = [
  'Happy', 'Sleepy', 'Bouncy', 'Fluffy', 'Sparkly', 'Dreamy', 'Cozy',
  'Sunny', 'Lucky', 'Sweet', 'Gentle', 'Snuggly', 'Cheerful', 'Bubbly', 'Peachy',
  'Tiny', 'Giant', 'Silky', 'Velvet', 'Shiny', 'Misty', 'Icy', 'Minty',
  'Spicy', 'Zesty', 'Yummy', 'Tasty', 'Jolly', 'Witty', 'Brave', 'Calm',
  'Wild', 'Noisy', 'Quiet', 'Busy', 'Lazy', 'Speedy', 'Playful', 'Cuddly',
  'Fuzzy', 'Wobbly', 'Wiggly', 'Giggly', 'Lovely', 'Dainty', 'Fancy', 'Glitzy',
  'Funky', 'Groovy', 'Spunky', 'Zany', 'Quirky', 'Magic', 'Mystic', 'Cosmic'
];

const NOUNS = [
  'Cloud', 'Star', 'Moon', 'Blossom', 'Pudding', 'Mochi', 'Cookie',
  'Cupcake', 'Marshmallow', 'Bubble', 'Sprinkle', 'Honey', 'Berry', 'Petal', 'Dewdrop',
  'Muffin', 'Bagel', 'Donut', 'Tart', 'Pie', 'Cake', 'Brownie', 'Fudge',
  'Candy', 'Toffee', 'Jelly', 'Jam', 'Butter', 'Toast', 'Bread', 'Bun',
  'Roll', 'Croissant', 'Waffle', 'Pancake', 'Crepe', 'Popcorn', 'Pretzel',
  'Cracker', 'Biscuit', 'Pebble', 'Sprout', 'Leaf', 'Branch', 'Root', 'Seed',
  'Nut', 'Shell', 'Pearl', 'Gem', 'Crystal', 'Rainbow', 'Aurora', 'Comet'
];

export function generateCuteName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

export function detectOS(userAgent: string): OSType {
  const ua = userAgent.toLowerCase();
  // ต้องเช็ค iPhone ก่อน iPad เพราะบาง UA อาจมีทั้งสองคำ
  if (ua.includes('iphone')) return 'ios';
  if (ua.includes('ipad')) return 'ipados';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'macos';
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('android')) return 'android';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

export function getDeviceName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('android')) return ua.includes('mobile') ? 'Android' : 'Android Tablet';
  if (ua.includes('linux')) return 'Linux';
  return 'Device';
}

export function assignCritter(userAgent: string): CritterInfo {
  const os = detectOS(userAgent);
  const critter = CRITTERS[os];
  return {
    type: critter.type,
    color: critter.color,
    emoji: critter.emoji,
    os,
  };
}

// Animal emojis for picker
export const ANIMAL_EMOJIS = [
  '🐱', '🐶', '🐰', '🐼', '🦊', '🦁', '🐯', '🐨', '🐻', '🐸',
  '🐵', '🐔', '🐧', '🐦', '🦉', '🦆', '🦅', '🐴', '🦄', '🐮',
  '🐷', '🐹', '🐭', '🐻‍❄️', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥',
  '🐿️', '🦔', '🐲', '🐉', '🦖', '🦕', '🐢', '🐍', '🦎', '🐊',
];
