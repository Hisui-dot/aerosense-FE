import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  decimals?: number;
}

/**
 * Lightweight count-up animation component for KPI numbers.
 * - When target > 0: smoothly counts from 0 (or previous value) to target over ~1.2s using an ease-out curve.
 * - When target === 0: performs a brief telemetry calibration spin-up tick before locking onto 0.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1200,
  className = '',
  decimals = 0,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [isTickingZero, setIsTickingZero] = useState<boolean>(false);
  const prevValueRef = useRef<number>(0);
  const hasMountedRef = useRef<boolean>(false);

  useEffect(() => {
    let rafId: number;
    const target = Number.isFinite(value) ? value : 0;

    // Handle 0 on initial mount with a subtle telemetry spin-up tick
    if (!hasMountedRef.current && target === 0) {
      hasMountedRef.current = true;
      setIsTickingZero(true);
      const zeroSteps = [0, 3, 7, 4, 2, 1, 0];
      const zeroDuration = 750;
      const startTime = performance.now();

      const stepZero = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / zeroDuration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const idx = Math.min(
          Math.floor(eased * (zeroSteps.length - 1)),
          zeroSteps.length - 1
        );
        setDisplayValue(zeroSteps[idx]);

        if (progress < 1) {
          rafId = requestAnimationFrame(stepZero);
        } else {
          setDisplayValue(0);
          setIsTickingZero(false);
          prevValueRef.current = 0;
        }
      };

      rafId = requestAnimationFrame(stepZero);
      return () => cancelAnimationFrame(rafId);
    }

    hasMountedRef.current = true;
    const startValue = prevValueRef.current;

    if (startValue === target) {
      setDisplayValue(target);
      return;
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth quartic ease-out curve
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const current = startValue + (target - startValue) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
        prevValueRef.current = target;
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  const formatted =
    decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue).toLocaleString();

  return (
    <span
      className={`inline-block tabular-nums transition-transform duration-300 ease-out ${
        isTickingZero ? 'scale-[1.02]' : 'scale-100'
      } ${className}`}
    >
      {formatted}
    </span>
  );
};

