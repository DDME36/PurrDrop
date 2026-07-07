'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// Singleton AudioContext - shared across all hook instances
let sharedAudioContext: AudioContext | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioContext = new AudioContextClass();
    }
  }

  return sharedAudioContext;
}

// Unlock audio on first interaction (Crucial for iOS Safari)
function unlockAudio() {
  if (isAudioUnlocked || typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  // Play a silent short buffer
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);

  isAudioUnlocked = true;
  
  // Cleanup listeners
  ['touchstart', 'touchend', 'mousedown', 'keydown'].forEach(e => 
    window.removeEventListener(e, unlockAudio)
  );
}

if (typeof window !== 'undefined') {
  ['touchstart', 'touchend', 'mousedown', 'keydown'].forEach(e => 
    window.addEventListener(e, unlockAudio, { once: true, passive: true })
  );
}

export function useSound() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);

  useEffect(() => {
    setTimeout(() => {
      setMuted(localStorage.getItem('critters_muted') === 'true');
    }, 0);
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);


  const toggle = useCallback(() => {
    setMuted(prev => {
      const newVal = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('critters_muted', String(newVal));
      }
      return newVal;
    });
  }, []);

  const play = useCallback((type: 'connect' | 'whoosh' | 'success' | 'notification' | 'tick' | 'progress25' | 'progress50' | 'progress75' | 'sending' | 'complete') => {
    if (mutedRef.current) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const playTone = (freq: number, duration: number, volume: number = 0.1, type: OscillatorType = 'sine', attack: number = 0.02) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        // ADSR Envelope for "Premium" feel (No clicks, smooth fade)
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + duration);
      };

      if (type === 'connect') {
        // Soft bubble pop
        playTone(600, 0.15, 0.08, 'sine', 0.01);
      } else if (type === 'whoosh' || type === 'sending') {
        // Elegant gentle slide up
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'success' || type === 'complete') {
        // Magical sparkling arpeggio (Premium feel)
        const notes = [523.25, 659.25, 830.61, 1046.50]; // C5, E5, G#5, C6
        notes.forEach((f, i) => {
          setTimeout(() => playTone(f, 0.6, 0.05, 'sine', 0.05), i * 60);
          setTimeout(() => playTone(f * 1.01, 0.4, 0.02, 'triangle', 0.02), i * 60); // Add slight chorus/shimmer
        });
      } else if (type === 'notification') {
        // Modern soft chime
        playTone(783.99, 0.4, 0.06, 'sine', 0.05); // G5
        setTimeout(() => playTone(1046.50, 0.5, 0.06, 'sine', 0.05), 120); // C6
      } else if (type === 'tick') {
        // Very subtle wood-like tick
        playTone(1000, 0.05, 0.02, 'sine', 0.005);
      } else if (type.startsWith('progress')) {
        const freqs = { progress25: 440, progress50: 554, progress75: 659 };
        playTone(freqs[type as keyof typeof freqs] || 440, 0.15, 0.03, 'triangle', 0.02);
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  }, []);

  const vibratePattern = useCallback((type: 'tap' | 'select' | 'success' | 'error' | 'progress' | 'milestone' | 'complete' | 'sending') => {
    if (!('vibrate' in navigator)) return;

    const patterns: Record<string, number | number[]> = {
      tap: 10,
      select: [10, 20, 10],
      success: [40, 40, 80],
      error: [80, 40, 80, 40, 80],
      progress: 5,
      milestone: [20, 20, 20],
      complete: [40, 20, 40, 20, 60],
      sending: [10, 30, 10, 30, 10],
    };

    navigator.vibrate(patterns[type] || 10);
  }, []);

  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }, []);

  return { muted, toggle, play, vibrate, vibratePattern };
}
