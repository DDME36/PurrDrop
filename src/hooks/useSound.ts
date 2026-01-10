'use client';

import { useState, useCallback, useEffect } from 'react';

export function useSound() {
  const [muted, setMuted] = useState(false);

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
    if (muted) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
  }, [muted]);

  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  return { muted, toggle, play, vibrate };
}
