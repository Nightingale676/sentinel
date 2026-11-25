import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export interface AccordionItemData {
  id: string;
  question: string;
  answer: string;
}

export function BouncyAccordion({ items }: { items: AccordionItemData[] }) {
  const prefersReduced = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            className={`bg-[var(--color-blush)] px-6 py-5 transition-colors ${
              isOpen
                ? 'border-2 border-[var(--color-signal-red)] ring-2 ring-[var(--color-signal-red)]/50'
                : 'border border-[var(--color-ink)]'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 py-1 text-left cursor-pointer"
            >
              <span className="flex items-baseline gap-3 text-base font-medium text-[var(--color-ink)]">
                {/* Ink background behind signal red question number guarantees >= 4.5:1 contrast */}
                <span className="bg-[var(--color-ink)] px-2 py-0.5 font-mono text-base font-semibold text-[var(--color-signal-red)] shrink-0">
                  {String(idx + 1).padStart(2, '0')}.
                </span>
                <span className="font-serif-italic text-xl text-[var(--color-ink)]">
                  {item.question}
                </span>
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={
                  prefersReduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 300, damping: 22 }
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-indigo)] text-[var(--color-paper)]"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={prefersReduced ? false : { opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={prefersReduced ? undefined : { opacity: 0, height: 0, y: -4 }}
                  transition={
                    prefersReduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 280, damping: 24 }
                  }
                  className="overflow-hidden"
                >
                  <p className="pt-3 pl-11 text-base leading-relaxed text-[var(--color-ink)]/90">
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
