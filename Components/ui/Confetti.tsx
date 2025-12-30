import React, { useEffect, useState, useRef } from "react";

interface ConfettiProps {
  active?: boolean;
  origin?: { x: number; y: number } | null;
}

export default function Confetti({ active = false, origin = null }: ConfettiProps) {
  const [particles, setParticles] = useState<any[]>([]);
  const [renderOrigin, setRenderOrigin] = useState<{ x: number; y: number } | null>(null);
  const animationKey = useRef(0);

  useEffect(() => {
    if (active && origin) {
      // Store the origin at the time of activation
      setRenderOrigin(origin);
      animationKey.current += 1;

      // Generate confetti particles that burst from origin point
      const particleCount = 60;
      const newParticles = Array.from({ length: particleCount }, (_, i) => {
        // Calculate angle for burst pattern (full 360 degrees)
        const angle = (i / particleCount) * 360 + (Math.random() * 30 - 15);
        const velocity = 150 + Math.random() * 200; // pixels to travel
        const radians = (angle * Math.PI) / 180;

        return {
          id: `${animationKey.current}-${i}`,
          angle,
          velocity,
          // Calculate end position based on angle
          translateX: Math.cos(radians) * velocity,
          translateY: Math.sin(radians) * velocity,
          delay: Math.random() * 0.15,
          duration: 1.5 + Math.random() * 1,
          rotation: Math.random() * 1080 - 540, // Random rotation between -540 and 540 degrees
          color: ['#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#fbbf24', '#f59e0b'][
            Math.floor(Math.random() * 9)
          ],
          size: 4 + Math.random() * 6, // Varied sizes
          shape: Math.random() > 0.5 ? 'square' : 'rect', // Mix of shapes
        };
      });
      setParticles(newParticles);

      // Clear particles after animation
      const timeout = setTimeout(() => {
        setParticles([]);
        setRenderOrigin(null);
      }, 3500);

      return () => clearTimeout(timeout);
    } else if (!active) {
      setParticles([]);
      setRenderOrigin(null);
    }
  }, [active, origin]);

  if (!active || particles.length === 0 || !renderOrigin) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute opacity-0"
          style={{
            left: renderOrigin.x,
            top: renderOrigin.y,
            width: particle.shape === 'rect' ? particle.size * 1.5 : particle.size,
            height: particle.shape === 'rect' ? particle.size * 0.6 : particle.size,
            backgroundColor: particle.color,
            borderRadius: particle.shape === 'square' ? '2px' : '1px',
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            animationName: 'confettiBurst',
            animationTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            animationFillMode: 'forwards',
            '--tx': `${particle.translateX}px`,
            '--ty': `${particle.translateY}px`,
            '--rot': `${particle.rotation}deg`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes confettiBurst {
          0% {
            transform: translate(-50%, -50%) translateX(0) translateY(0) rotateZ(0deg) scale(0);
            opacity: 1;
          }
          10% {
            transform: translate(-50%, -50%) translateX(calc(var(--tx) * 0.1)) translateY(calc(var(--ty) * 0.1)) rotateZ(calc(var(--rot) * 0.1)) scale(1);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translateX(var(--tx)) translateY(calc(var(--ty) + 100px)) rotateZ(var(--rot)) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
