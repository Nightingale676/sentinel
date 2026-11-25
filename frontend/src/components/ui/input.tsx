import * as React from 'react';
import { cn } from '@/src/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex min-h-[44px] w-full border border-[var(--ink)] bg-[var(--bg-paper)] px-3.5 py-2 text-base text-[var(--ink)] placeholder:text-[var(--ink-muted)] transition-colors focus:border-[var(--accent-red)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
