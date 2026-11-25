import { cn } from '@/src/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse border border-[var(--ink)]/25 bg-[var(--ink-subtle)]',
        className
      )}
    />
  );
}
