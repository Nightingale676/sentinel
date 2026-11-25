import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { cn } from '@/src/lib/utils';

export interface ExpandableTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ExpandableTabsNavProps {
  tabs: ExpandableTabItem[];
  activeTab: string;
  onSelect: (id: string) => void;
}

export function ExpandableTabsNav({ tabs, activeTab, onSelect }: ExpandableTabsNavProps) {
  const prefersReduced = useReducedMotion();

  return (
    <nav
      aria-label="Customer workspace navigation"
      className="inline-flex items-center gap-1 border border-[var(--ink)] bg-[var(--bg-paper)] p-1"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
            className={cn(
              'relative flex min-h-[40px] items-center gap-2 px-3.5 text-base font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer',
              isActive
                ? 'bg-[var(--ink)] text-[var(--bg-paper)]'
                : 'text-[var(--ink)] hover:bg-[var(--ink-subtle)]'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <AnimatePresence initial={false} mode="wait">
              {isActive || typeof window === 'undefined' ? (
                <motion.span
                  key="label-active"
                  initial={prefersReduced ? false : { opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={prefersReduced ? undefined : { opacity: 0, width: 0 }}
                  transition={{ duration: 0.16 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {tab.label}
                </motion.span>
              ) : (
                <span className="hidden md:inline whitespace-nowrap">{tab.label}</span>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </nav>
  );
}
