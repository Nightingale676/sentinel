import * as React from 'react';
import { cn } from '@/src/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'border border-[var(--ink)] bg-[var(--ink)] text-[var(--bg-paper)] hover:opacity-85',
      secondary:
        'border border-[var(--ink)] bg-[var(--bg-paper)] text-[var(--ink)] hover:bg-[var(--ink-subtle)]',
      outline:
        'border border-[var(--ink)] bg-[var(--bg-paper)] text-[var(--ink)] hover:bg-[var(--ink-subtle)]',
      ghost:
        'border border-transparent bg-transparent text-[var(--ink)] hover:border-[var(--ink)]',
      danger:
        'border border-[var(--accent-red)] bg-[var(--accent-red)] text-[var(--bg-paper)] hover:opacity-90',
    };

    const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'min-h-[40px] px-4 text-base',
      md: 'min-h-[44px] px-5 text-base',
      lg: 'min-h-[48px] px-6 text-base',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-sans font-medium whitespace-nowrap shrink-0 transition-opacity duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
