import React, { forwardRef, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { TrendingDown } from "lucide-react";

interface LowestPriceOnlineBadgeProps {
  animate?: boolean;
  onAnimationComplete?: () => void;
}

const LowestPriceOnlineBadge = forwardRef<HTMLDivElement, LowestPriceOnlineBadgeProps>(
  ({ animate = false, onAnimationComplete }, ref) => {
    const badgeRef = useRef<HTMLDivElement>(null);
    const hasAnimatedRef = useRef(false);

    useEffect(() => {
      if (animate && !hasAnimatedRef.current) {
        hasAnimatedRef.current = true;
        // Animation duration: bulge takes 600ms, then callback
        const timeout = setTimeout(() => {
          onAnimationComplete?.();
        }, 600);
        return () => clearTimeout(timeout);
      }

      // Reset when animate becomes false
      if (!animate) {
        hasAnimatedRef.current = false;
      }
    }, [animate, onAnimationComplete]);

    return (
      <div ref={ref} className="relative inline-block">
        <Badge
          ref={badgeRef}
          className={`
            bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 gap-1
            relative overflow-hidden
            ${animate ? 'animate-bulge' : ''}
          `}
        >
          <TrendingDown className="w-3 h-3" />
          Lowest Price Online
          {/* Shine effect overlay */}
          {animate && (
            <span className="absolute inset-0 animate-shine" />
          )}
        </Badge>
        <style>{`
          @keyframes bulge {
            0% {
              transform: scale(1);
            }
            30% {
              transform: scale(1.3);
            }
            50% {
              transform: scale(1.2);
            }
            70% {
              transform: scale(1.25);
            }
            100% {
              transform: scale(1);
            }
          }
          .animate-bulge {
            animation: bulge 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          @keyframes shine {
            0% {
              background: linear-gradient(
                120deg,
                transparent 0%,
                transparent 40%,
                rgba(255, 255, 255, 0.8) 50%,
                transparent 60%,
                transparent 100%
              );
              background-size: 200% 100%;
              background-position: 200% 0;
            }
            100% {
              background: linear-gradient(
                120deg,
                transparent 0%,
                transparent 40%,
                rgba(255, 255, 255, 0.8) 50%,
                transparent 60%,
                transparent 100%
              );
              background-size: 200% 100%;
              background-position: -200% 0;
            }
          }
          .animate-shine {
            animation: shine 600ms ease-out forwards;
          }
        `}</style>
      </div>
    );
  }
);

LowestPriceOnlineBadge.displayName = 'LowestPriceOnlineBadge';

export default LowestPriceOnlineBadge;
