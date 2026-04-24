'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// Singleton AudioContext - shared across all hook instances
let sharedAudioContext: AudioContext | null = null;

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

export function useSound() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const saved = localStorage.getItem('critters_muted');
    if (saved === 'true') setMuted(true);
  }, []);

  const toggle = useCallback(() => {
    setMuted(prev => {
      const newVal = !prev;
      localStorage.setItem('critters_muted', String(newVal));
      return newVal;
    });
  }, []);

  const play = useCallback((type: 'connect' | 'whoosh' | 'success' | 'notification' | 'tick' | 'progress25' | 'progress50' | 'progress75' | 'sending' | 'complete') => {
    if (mutedRef.current) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const playTone = (freq: number, duration: number, volume: number = 0.1, type: OscillatorType = 'sine', decay: number = 0.1) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        // ADSR Envelope for "Premium" feel (No clicks, smooth fade)
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + duration);
      };

      if (type === 'connect') {
        // Soft bubble pop
        playTone(600, 0.1, 0.08, 'sine');
      } else if (type === 'whoosh' || type === 'sending') {
        // Elegant slide up
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'success' || type === 'complete') {
        // Harplike ascending notes (Premium feel)
        [659.25, 830.61, 987.77].forEach((f, i) => {
          setTimeout(() => playTone(f, 0.4, 0.06, 'sine'), i * 80);
        });
      } else if (type === 'notification') {
        // Modern chime
        playTone(880, 0.3, 0.08, 'sine');
        setTimeout(() => playTone(740, 0.3, 0.08, 'sine'), 100);
      } else if (type === 'tick') {
        // Very subtle wood-like tick
        playTone(1200, 0.05, 0.03, 'sine');
      } else if (type.startsWith('progress')) {
        const freqs = { progress25: 440, progress50: 554, progress75: 659 };
        playTone(freqs[type as keyof typeof freqs] || 440, 0.2, 0.05, 'sine');
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
