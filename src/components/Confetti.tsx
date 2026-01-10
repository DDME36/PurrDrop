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
  }>>([]);
  const animatingRef = useRef(false);

  const colors = ['#ffb3d1', '#a8e6cf', '#ffd3b6', '#c7ceea', '#fff'];

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

    particlesRef.current = particlesRef.current.filter(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();

      return p.y < canvas.height + 20;
    });

    if (particlesRef.current.length > 0) {
      requestAnimationFrame(animate);
    } else {
      animatingRef.current = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const burst = (count = 100) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: -20,
          size: Math.random() * 10 + 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          speedY: Math.random() * 3 + 2,
          speedX: Math.random() * 4 - 2,
          rotation: Math.random() * 360,
          rotationSpeed: Math.random() * 10 - 5,
        });
      }, i * 20);
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
