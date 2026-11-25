import React, { useId } from 'react';
import { cn } from '@/src/lib/utils';

export type StatusKind = 'allow' | 'step_up' | 'block';

interface StatusBadgeProps {
  kind: StatusKind;
  label: string;
  compact?: boolean;
  tone?: 'research' | 'vivid';
  className?: string;
}

/**
 * Accessible status badge that always combines text + visual treatment:
 * - research (Customer Portal & /client B2B Dashboard):
 *   - allow: ink outline on paper
 *   - step_up: ink outline with SVG diagonal hatching (no gradients)
 *   - block: solid muted red (#B5473A) with paper text
 * - vivid (Marketing bands: Simulator, Protection, Lens Portal):
 *   - allow: solid green (#2FA66A) with ink (#141414) text (5.9:1)
 *   - step_up: solid amber (#F2A93B) with diagonal hatching & ink (#141414) text (9.16:1)
 *   - block: solid signal red (#E5432E) with ink (#141414) text (4.51:1)
 */
export function StatusBadge({
  kind,
  label,
  compact = false,
  tone = 'research',
  className,
}: StatusBadgeProps) {
  const patternId = useId().replace(/:/g, '');

  if (tone === 'vivid') {
    if (kind === 'block') {
      return (
        <span
          className={cn(
            'relative inline-flex items-center justify-center border border-[var(--color-ink)] bg-[var(--color-signal-red)] font-mono font-semibold uppercase tracking-wide text-[var(--color-ink)] whitespace-nowrap',
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-base',
            className
          )}
        >
          {label}
        </span>
      );
    }

    if (kind === 'step_up') {
      return (
        <span
          className={cn(
            'relative inline-flex items-center justify-center overflow-hidden border border-[var(--color-ink)] bg-[var(--color-amber)] font-mono font-semibold uppercase tracking-wide text-[var(--color-ink)] whitespace-nowrap',
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-base',
            className
          )}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
          >
            <defs>
              <pattern
                id={patternId}
                width="6"
                height="6"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="#141414" strokeWidth="1.2" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
          </svg>
          <span className="relative z-10">{label}</span>
        </span>
      );
    }

    return (
      <span
        className={cn(
          'inline-flex items-center justify-center border border-[var(--color-ink)] bg-[var(--color-green)] font-mono font-semibold uppercase tracking-wide text-[var(--color-ink)] whitespace-nowrap',
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-base',
          className
        )}
      >
        {label}
      </span>
    );
  }

  if (kind === 'block') {
    return (
      <span
        className={cn(
          'relative inline-flex items-center justify-center border border-[var(--accent-red)] bg-[var(--accent-red)] font-mono font-semibold uppercase tracking-wide text-[var(--bg-paper)] whitespace-nowrap',
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-base',
          className
        )}
      >
        {label}
      </span>
    );
  }

  if (kind === 'step_up') {
    return (
      <span
        className={cn(
          'relative inline-flex items-center justify-center overflow-hidden border border-[var(--ink)] bg-[var(--bg-paper)] font-mono font-semibold uppercase tracking-wide text-[var(--ink)] whitespace-nowrap',
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-base',
          className
        )}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
        >
          <defs>
            <pattern
              id={patternId}
              width="6"
              height="6"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
        <span className="relative z-10 bg-[var(--bg-paper)]/85 px-1">{label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center border border-[var(--ink)] bg-[var(--bg-paper)] font-mono font-medium uppercase tracking-wide text-[var(--ink)] whitespace-nowrap',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-base',
        className
      )}
    >
      {label}
    </span>
  );
}
