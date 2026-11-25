import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Glasses,
  Headphones,
  KeyRound,
  Landmark,
  Lock,
  Mic,
  Receipt,
  ShieldCheck,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import { StatusBadge, type StatusKind } from '../ui/StatusBadge';

export interface ThingsDragScrollGridProps {
  itemCount?: number;
  itemGap?: number;
  columns?: number;
  itemWidth?: number;
  itemHeight?: number;
}

interface ProtectedActionItem {
  id: string;
  title: string;
  description: string;
  rule: string;
  kind: StatusKind;
  icon: React.ComponentType<{ className?: string }>;
}

const PROTECTED_ITEMS: ProtectedActionItem[] = [
  {
    id: 'voice-transfer',
    title: 'Voice transfer',
    description: 'Verifies live speech before moving money.',
    rule: 'ALLOW',
    kind: 'allow',
    icon: ArrowLeftRight,
  },
  {
    id: 'new-payee',
    title: 'New payee',
    description: 'Asks for your personal passphrase first.',
    rule: 'STEP UP',
    kind: 'step_up',
    icon: UserPlus,
  },
  {
    id: 'password-reset',
    title: 'Password reset',
    description: 'Stops synthetic callers from resetting logins.',
    rule: 'BLOCK',
    kind: 'block',
    icon: KeyRound,
  },
  {
    id: 'phone-change',
    title: 'Phone change',
    description: 'Stops SIM-swap impersonation attempts.',
    rule: 'STEP UP',
    kind: 'step_up',
    icon: Smartphone,
  },
  {
    id: 'support-call',
    title: 'Support call',
    description: 'Confirms your identity on agent calls.',
    rule: 'ALLOW',
    kind: 'allow',
    icon: Headphones,
  },
  {
    id: 'assistant-command',
    title: 'Speaker action',
    description: 'Keeps smart speaker requests strictly yours.',
    rule: 'ALLOW',
    kind: 'allow',
    icon: Mic,
  },
  {
    id: 'wire-approval',
    title: 'Wire approval',
    description: 'Guards high-value external transfers.',
    rule: 'STEP UP',
    kind: 'step_up',
    icon: Landmark,
  },
  {
    id: 'card-freeze',
    title: 'Card freeze',
    description: 'Allows instant card lock from your voice.',
    rule: 'ALLOW',
    kind: 'allow',
    icon: Lock,
  },
  {
    id: 'recurring-bill',
    title: 'Recurring bill',
    description: 'Approves trusted utility payments smoothly.',
    rule: 'ALLOW',
    kind: 'allow',
    icon: Receipt,
  },
  {
    id: 'statement-export',
    title: 'Account export',
    description: 'Stops unauthorized statement downloads.',
    rule: 'BLOCK',
    kind: 'block',
    icon: FileSpreadsheet,
  },
  {
    id: 'glasses-auth',
    title: 'Smart glasses',
    description: 'Verifies hands-free wearable requests.',
    rule: 'ALLOW',
    kind: 'allow',
    icon: Glasses,
  },
  {
    id: 'beneficiary-edit',
    title: 'Profile update',
    description: 'Safeguards trusted recovery contacts.',
    rule: 'STEP UP',
    kind: 'step_up',
    icon: ShieldCheck,
  },
];

export function ThingsDragScrollGrid({
  itemCount = 12,
  itemGap = 16,
  itemWidth = 286,
  itemHeight = 190,
}: ThingsDragScrollGridProps) {
  const prefersReduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef({ clientX: 0, scrollLeft: 0 });

  const baseItems = Array.from(
    { length: itemCount },
    (_, i) => PROTECTED_ITEMS[i % PROTECTED_ITEMS.length]
  );

  const updateScrollBounds = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const current = el.scrollLeft;
    setCanScrollLeft(current > 4);
    setCanScrollRight(maxScroll - current > 4);
    setScrollProgress(maxScroll > 0 ? Math.min(1, Math.max(0, current / maxScroll)) : 1);
  }, []);

  useEffect(() => {
    updateScrollBounds();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateScrollBounds);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollBounds]);

  const scrollByStep = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = (itemWidth + itemGap) * 2;
    el.scrollBy({
      left: direction * step,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = scrollRef.current;
    if (!el) return;
    setIsDragging(true);
    dragOrigin.current = {
      clientX: e.clientX,
      scrollLeft: el.scrollLeft,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollRef.current) return;
    const dx = e.clientX - dragOrigin.current.clientX;
    scrollRef.current.scrollLeft = dragOrigin.current.scrollLeft - dx;
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const rowsCount = baseItems.length > 4 ? 2 : 1;

  return (
    <div className="relative">
      {/* Controls & finite indicator */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 font-mono text-base text-[var(--color-paper)]">
        <span>
          Horizontal specimen strip · {baseItems.length} covered surfaces
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            disabled={!canScrollLeft}
            aria-label="Scroll protected actions left"
            className="inline-flex min-h-[40px] items-center gap-1 border border-[var(--color-paper)] bg-[var(--color-ink)] px-3 py-1 font-mono text-base font-medium text-[var(--color-paper)] hover:bg-[var(--color-blush)] hover:text-[var(--color-ink)] disabled:bg-transparent disabled:opacity-55 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Prev</span>
          </button>
          <button
            type="button"
            onClick={() => scrollByStep(1)}
            disabled={!canScrollRight}
            aria-label="Scroll protected actions right"
            className="inline-flex min-h-[40px] items-center gap-1 border border-[var(--color-paper)] bg-[var(--color-ink)] px-3 py-1 font-mono text-base font-medium text-[var(--color-paper)] hover:bg-[var(--color-blush)] hover:text-[var(--color-ink)] disabled:bg-transparent disabled:opacity-55 disabled:pointer-events-none cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Finite horizontal scroll viewport */}
      <div className="relative overflow-hidden border border-[var(--color-ink)] bg-[var(--color-ink)]/20">
        <div
          ref={scrollRef}
          onScroll={updateScrollBounds}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="region"
          tabIndex={0}
          aria-label="Protected actions horizontal list"
          className={`w-full overflow-x-auto overflow-y-hidden p-4 sm:p-5 select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ scrollbarWidth: 'thin' }}
        >
          <div
            className="grid grid-flow-col w-max"
            style={{
              gridTemplateRows: `repeat(${rowsCount}, ${itemHeight}px)`,
              gridAutoColumns: `${itemWidth}px`,
              gap: `${itemGap}px`,
            }}
          >
            {baseItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={prefersReduced ? false : { opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ root: scrollRef, once: true, amount: 0.15 }}
                  transition={{ duration: 0.24, delay: Math.min(idx, 5) * 0.03 }}
                  className="flex flex-col justify-between border border-[var(--color-ink)] bg-[var(--color-blush)] p-4 text-[var(--color-ink)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <StatusBadge kind={item.kind} tone="vivid" label={item.rule} />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-bold uppercase text-[var(--color-ink)]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-base leading-snug text-[var(--color-ink)]/85">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Finite horizontal progress hairline */}
        <div
          aria-hidden="true"
          className="h-[3px] w-full border-t border-[var(--color-ink)] bg-[var(--color-ink)]/30"
        >
          <div
            className="h-full bg-[var(--color-blush)] transition-transform duration-150"
            style={{
              width: '100%',
              transformOrigin: 'left center',
              transform: `scaleX(${Math.max(0.18, scrollProgress)})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
