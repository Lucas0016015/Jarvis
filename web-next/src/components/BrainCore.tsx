'use client';

import React, { useEffect, useRef } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';

/* ── BrainCore ──────────────────────────────────────────────────────────
   Lightweight neural visualization — glowing orb with particle field.
   No Three.js dependency to keep bundle lean and fast.
   ───────────────────────────────────────────────────────────────────── */

export default function BrainCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { activityState } = useJarvisStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; color: string;
    }> = [];

    const PARTICLE_COUNT = 80;
    const CONNECTION_DIST = 100;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    const initParticles = (w: number, h: number) => {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 2 + 0.5,
          alpha: Math.random() * 0.5 + 0.2,
          color: Math.random() > 0.7 ? '#ff00a0' : '#00d4ff',
        });
      }
    };

    resize();
    const rect = canvas.getBoundingClientRect();
    initParticles(rect.width, rect.height);
    window.addEventListener('resize', () => {
      resize();
      const r = canvas.getBoundingClientRect();
      initParticles(r.width, r.height);
    });

    const draw = () => {
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      const cx = w / 2;
      const cy = h / 2;
      const isActive = activityState === 'thinking' || activityState === 'speaking';
      const time = Date.now() / 1000;

      ctx.clearRect(0, 0, w, h);

      // Central glow
      const pulseSize = 80 + (isActive ? Math.sin(time * 3) * 15 : Math.sin(time * 1) * 8);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseSize * 2);
      grad.addColorStop(0, 'rgba(0, 212, 255, 0.15)');
      grad.addColorStop(0.5, 'rgba(0, 212, 255, 0.05)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseSize * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core ring
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseSize * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glow
      const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseSize * 0.4);
      innerGrad.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
      innerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseSize * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Movement speed based on state
        const speedMult = isActive ? 1.8 : 1;
        p.x += p.vx * speedMult;
        p.y += p.vy * speedMult;

        // Wrap around
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Connections
        if (isActive) {
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < CONNECTION_DIST) {
              const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
              ctx.strokeStyle = '#00d4ff';
              ctx.globalAlpha = alpha;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
      }

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activityState]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  );
}
