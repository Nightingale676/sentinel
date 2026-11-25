import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ShieldAlert, ShieldCheck, KeyRound, ChevronRight } from 'lucide-react';

interface IslandEvent {
  id: string;
  kind: 'blocked' | 'verified' | 'stepup';
  title: string;
  detail: string;
}

const DEMO_EVENTS: IslandEvent[] = [
  {
    id: 'evt-1',
    kind: 'blocked',
    title: 'Sentinel blocked a cloned voice',
    detail: 'Stopped an unverified wire request before funds moved. Demo value.',
  },
  {
    id: 'evt-2',
    kind: 'verified',
    title: 'Routine bill verified in 140 ms',
    detail: 'Natural owner speech matched on trusted mobile device. Demo value.',
  },
  {
    id: 'evt-3',
    kind: 'stepup',
    title: 'Extra check asked for new payee',
    detail: 'Requested personal passphrase before adding recipient. Demo value.',
  },
];

export function DynamicIslandPill() {
  const prefersReduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (prefersReduced) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % DEMO_EVENTS.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [prefersReduced]);

  const current = DEMO_EVENTS[index];

  const icon =
    current.kind === 'blocked' ? (
      <ShieldAlert className="h-4 w-4 text-[var(--accent-red)] shrink-0" />
    ) : current.kind === 'stepup' ? (
      <KeyRound className="h-4 w-4 text-[var(--ink)] shrink-0" />
    ) : (
      <ShieldCheck className="h-4 w-4 text-[var(--ink)] shrink-0" />
    );

  return (
    <div className="flex justify-center px-4">
      <motion.button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`Live protection example: ${current.title}`}
        layout={!prefersReduced}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="group relative inline-flex max-w-full flex-col items-start border border-[var(--ink)] bg-[var(--bg-paper)] px-5 py-2.5 text-left text-[var(--ink)] hover:bg-[var(--ink-subtle)] cursor-pointer"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={prefersReduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-3"
          >
            {icon}
            <span className="font-mono text-base font-medium tracking-tight text-[var(--ink)] whitespace-nowrap truncate max-w-[230px] sm:max-w-none">
              {current.title}
            </span>
            <ChevronRight
              className={`h-4 w-4 text-[var(--ink-muted)] transition-transform duration-200 ${
                expanded ? 'rotate-90' : ''
              }`}
            />
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={prefersReduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={prefersReduced ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <p className="mt-2 border-t border-[var(--ink)]/20 pt-2 font-sans text-base text-[var(--ink-muted)] leading-relaxed">
                {current.detail}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
