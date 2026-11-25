import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface RollingTextProps {
  text: string;
  className?: string;
  staggerMs?: number;
  highlightWordIndex?: number;
  highlightClassName?: string;
}

export function RollingText({
  text,
  className,
  staggerMs = 35,
  highlightWordIndex,
  highlightClassName = 'text-[var(--color-signal-red)]',
}: RollingTextProps) {
  const prefersReduced = useReducedMotion();
  const words = text.split(' ');

  if (prefersReduced) {
    return (
      <span className={cn('inline-flex flex-wrap justify-center gap-x-[0.28em]', className)}>
        {words.map((word, idx) => (
          <span
            key={`${word}-${idx}`}
            className={idx === highlightWordIndex ? highlightClassName : undefined}
          >
            {word}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex flex-wrap justify-center gap-x-[0.28em]', className)}>
      {words.map((word, idx) => (
        <span key={`${word}-${idx}`} className="inline-block overflow-hidden align-bottom pb-[0.06em]">
          <motion.span
            className={cn('inline-block', idx === highlightWordIndex ? highlightClassName : undefined)}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{
              duration: 0.5,
              delay: idx * (staggerMs / 1000),
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
