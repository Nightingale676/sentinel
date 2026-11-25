import React, { useState } from 'react';
import { cn } from '@/src/lib/utils';

interface GradientHoverCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function GradientHoverCard({ children, className, ...props }: GradientHoverCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative border border-[var(--ink)] bg-[var(--bg-paper)] p-6 text-[var(--ink)] transition-colors duration-150',
        hovered ? 'bg-[var(--ink-subtle)]' : '',
        className
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
