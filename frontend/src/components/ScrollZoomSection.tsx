import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

export interface ScrollZoomSectionProps {
  id?: string;
  ariaLabel?: string;
  bandBackground: string;
  bandText?: string;
  onBecomeActive?: (bandBackground: string) => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Full-width editorial band that gently zooms forward as the user scrolls into view
 * and notifies the page shell so background colors transition smoothly between bands.
 */
export function ScrollZoomSection({
  id,
  ariaLabel,
  bandBackground,
  bandText = 'var(--color-ink)',
  onBecomeActive,
  className = '',
  children,
}: ScrollZoomSectionProps) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.96', 'start 0.28'],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.65, 1], [0.78, 0.96, 1]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onBecomeActive || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onBecomeActive(bandBackground);
          }
        }
      },
      { rootMargin: '-38% 0px -38% 0px', threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [bandBackground, onBecomeActive]);

  return (
    <section
      ref={ref}
      id={id}
      aria-label={ariaLabel}
      style={{
        backgroundColor: bandBackground,
        color: bandText,
      }}
      className={`w-full scroll-mt-20 border-t border-[var(--color-ink)] ${
        prefersReduced ? '' : 'transition-colors duration-500 ease-out'
      } ${className}`}
    >
      <motion.div
        style={prefersReduced ? undefined : { scale, opacity, transformOrigin: 'center top' }}
      >
        {children}
      </motion.div>
    </section>
  );
}
