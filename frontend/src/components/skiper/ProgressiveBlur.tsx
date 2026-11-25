import { cn } from '@/src/lib/utils';

interface ProgressiveBlurProps {
  position: 'top' | 'bottom';
  className?: string;
}

export function ProgressiveBlur({ position, className }: ProgressiveBlurProps) {
  const isTop = position === 'top';
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute left-0 right-0 z-10 h-10 bg-[var(--bg-paper)]/75',
        isTop ? 'top-0 border-b border-[var(--ink)]/15' : 'bottom-0 border-t border-[var(--ink)]/15',
        className
      )}
      style={{
        backdropFilter: 'blur(3px)',
      }}
    />
  );
}
