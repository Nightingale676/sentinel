import { useEffect, useState } from 'react';
import { useMotionValue, useSpring, useReducedMotion } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function AnimatedNumber({ value, suffix = '', prefix = '', className }: AnimatedNumberProps) {
  const prefersReduced = useReducedMotion();
  const motionVal = useMotionValue(value);
  const spring = useSpring(motionVal, { stiffness: 90, damping: 20, mass: 0.8 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      return;
    }
    motionVal.set(value);
  }, [value, motionVal, prefersReduced]);

  useEffect(() => {
    if (prefersReduced) return;
    const unsubscribe = spring.on('change', (latest) => {
      setDisplay(Math.round(latest));
    });
    return unsubscribe;
  }, [spring, prefersReduced]);

  return (
    <span className={`tabular-nums ${className ?? ''}`}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
