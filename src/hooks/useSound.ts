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

  // Keep ref in sync for use in callbacks
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

  const play = useCallback((type: 'connect' | 'whoosh' | 'success' | 'notification') => {
    // Use ref to avoid stale closure
    if (mutedRef.current) return;
    
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      // Resume if suspended (required after user interaction in modern browsers)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'connect') {
        osc.frequency.value = 800;
        gain.gain.value = 0.1;
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'whoosh') {
        osc.frequency.value = 400;
        gain.gain.value = 0.1;
        osc.start();
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.2);
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'success') {
        osc.frequency.value = 600;
        gain.gain.value = 0.1;
        osc.start();
        osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.15);
        osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'notification') {
        // Two-tone notification sound
        osc.frequency.value = 880;
        gain.gain.value = 0.12;
        osc.start();
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio not supported
    }
  }, []);

  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  return { muted, toggle, play, vibrate };
}
