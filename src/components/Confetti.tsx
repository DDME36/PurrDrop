'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface ConfettiRef {
  burst: (count?: number) => void;
}

export const Confetti = forwardRef<ConfettiRef>(function Confetti(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    size: number;
    color: string;
    speedY: number;
    speedX: number;
    rotation: number;
    rotationSpeed: number;
    shape: 'square' | 'circle';
    opacity: number;
    decay: number;
  }>>([]);
  const animatingRef = useRef(false);

  const colors = ['#ffb3d1', '#a8e6cf', '#ffd3b6', '#c7ceea', '#ffdfba'];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const animate = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (particlesRef.current.length === 0) {
      animatingRef.current = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gravity = 0.15;
    const drag = 0.98; // Air resistance

    particlesRef.current = particlesRef.current.filter(p => {
      p.speedY += gravity;
      p.speedX *= drag;
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0) return false;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }

      ctx.restore();

      return p.y < canvas.height + 20 && p.opacity > 0;
    });

    if (particlesRef.current.length > 0) {
      requestAnimationFrame(animate);
    } else {
      animatingRef.current = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const burst = (count = 120) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Burst from center-bottom instead of top for a celebration feel
    const startX = canvas.width / 2;
    const startY = canvas.height * 0.8;
    
    // Adjust spread and count for mobile screens
    const isMobile = canvas.width < 768;
    const spread = isMobile ? 12 : 20;
    const actualCount = isMobile ? Math.floor(count * 0.6) : count;

    for (let i = 0; i < actualCount; i++) {
      particlesRef.current.push({
        x: startX,
        y: startY,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * -15 - 5, // Shoot up
        speedX: Math.random() * spread - (spread / 2), // Dynamic spread based on screen
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 15 - 7.5,
        shape: Math.random() > 0.5 ? 'square' : 'circle',
        opacity: 1,
        decay: Math.random() * 0.005 + 0.002, // Fade out over time
      });
    }

    if (!animatingRef.current) {
      animatingRef.current = true;
      animate();
    }
  };

  useImperativeHandle(ref, () => ({ burst }));

  return (
    <canvas
      ref={canvasRef}
      id="confettiCanvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
});
