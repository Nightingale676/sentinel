import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { AudioLines, ShieldCheck, UserCheck } from 'lucide-react';
import { ThingsDragScrollGrid } from './skiper/ThingsDragScrollGrid';
import { BouncyAccordion, type AccordionItemData } from './skiper/BouncyAccordion';
import { TryItSimulator } from './TryItSimulator';
import { Button } from './ui/button';
import { ScrollZoomSection } from './ScrollZoomSection';

const FAQ_ITEMS: AccordionItemData[] = [
  {
    id: 'faq-1',
    question: 'What happens if someone plays a recording or AI clone of my voice?',
    answer:
      'Sentinel listens for subtle synthesis artifacts and checks whether your trusted phone or wearable is physically present. Even a convincing recording is stopped before money or account changes occur.',
  },
  {
    id: 'faq-2',
    question: 'Can I still use my account if I lose my voice or my microphone is muted?',
    answer:
      'Yes. You can always switch to the typed assistant or confirm sensitive actions with your personal passphrase and phone verification.',
  },
  {
    id: 'faq-3',
    question: 'Does Sentinel slow down everyday bills and transfers?',
    answer:
      'No. Routine requests from your verified voice and trusted device clear immediately. Extra verification only appears when an action is unusually large or targets an unfamiliar payee.',
  },
  {
    id: 'faq-4',
    question: 'Do I see confusing security scores or technical alerts?',
    answer:
      'Never. Sentinel translates every check into plain-language outcomes—Allow, Step up, or Block—alongside a clear reason.',
  },
];

const STEPS = [
  {
    step: '01',
    label: 'ENROLL',
    title: 'Calibrate Voice',
    description:
      'Read three short everyday phrases and choose a personal passphrase. Sentinel stores an encrypted vocal signature rather than raw recordings.',
    icon: AudioLines,
    surfaceClass: 'bg-[var(--color-indigo)] text-[var(--color-paper)]',
    iconBorderClass: 'border-[var(--color-paper)] text-[var(--color-paper)]',
    ruleClass: 'border-[var(--color-paper)]/40',
    subTextClass: 'text-[var(--color-paper)]/90',
  },
  {
    step: '02',
    label: 'CLEAR',
    title: 'Everyday Access',
    description:
      'Pay familiar bills, inspect balances, or approve small transfers hands-free while hardware context runs quietly in the background.',
    icon: ShieldCheck,
    surfaceClass: 'bg-[var(--color-signal-red)] text-[var(--color-ink)]',
    iconBorderClass: 'border-[var(--color-ink)] text-[var(--color-ink)]',
    ruleClass: 'border-[var(--color-ink)]',
    subTextClass: 'text-[var(--color-ink)]',
  },
  {
    step: '03',
    label: 'PAUSE',
    title: 'Step-Up Guard',
    description:
      'Unusual sums, new recipients, or synthetic speech artifacts trigger an immediate passphrase check or block the transfer outright.',
    icon: UserCheck,
    surfaceClass: 'bg-[var(--color-ink)] text-[var(--color-paper)]',
    iconBorderClass: 'border-[var(--color-paper)] text-[var(--color-paper)]',
    ruleClass: 'border-[var(--color-paper)]/40',
    subTextClass: 'text-[var(--color-paper)]/90',
  },
];

interface LandingSectionsProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onNavigateClient: () => void;
  onBecomeActive?: (bandBackground: string) => void;
}

export function LandingSections({
  onGetStarted,
  onSignIn,
  onNavigateClient,
  onBecomeActive,
}: LandingSectionsProps) {
  const prefersReduced = useReducedMotion();
  const stepsSectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: stepsProgress } = useScroll({
    target: stepsSectionRef,
    offset: ['start 0.8', 'center 0.4'],
  });
  const linePathLength = useTransform(stepsProgress, [0, 1], [0, 1]);

  return (
    <>
      {/* 03 Coverage: Indigo background, Paper text, Blush cards with Ink text */}
      <ScrollZoomSection
        id="protects"
        ariaLabel="What Sentinel protects"
        bandBackground="var(--color-indigo)"
        bandText="var(--color-paper)"
        onBecomeActive={onBecomeActive}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-6 max-w-3xl">
            <p className="font-mono text-base font-semibold uppercase tracking-wider text-[var(--color-blush)]">
              03 Coverage · Scope
            </p>
            <h2 className="mt-2 font-display text-4xl font-black uppercase text-[var(--color-paper)] sm:text-6xl">
              Protected Surfaces
            </h2>
            <p className="mt-2 font-serif-italic text-xl text-[var(--color-paper)]">
              Every spoken instruction passes through{' '}
              <span className="underline decoration-[var(--color-blush)] decoration-2 underline-offset-4">
                policy screening
              </span>{' '}
              prior to account execution.
            </p>
          </div>

          <ThingsDragScrollGrid
            itemCount={12}
            itemGap={16}
            columns={4}
            itemWidth={286}
            itemHeight={190}
          />

          <p className="mt-4 font-mono text-base text-[var(--color-paper)]/85">
            Fig. 3 — Policy classification across twelve banking and wearable action categories.
          </p>
        </div>
      </ScrollZoomSection>

      {/* 04 Methodology: Paper background, Ink text, red step numbers, thin ink rules, layer cards in Indigo, Red, and Ink */}
      <ScrollZoomSection
        id="how-it-works"
        ariaLabel="Three-stage firewall protocol"
        bandBackground="var(--color-paper)"
        bandText="var(--color-ink)"
        onBecomeActive={onBecomeActive}
      >
        <div ref={stepsSectionRef} className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="font-mono text-base font-semibold uppercase tracking-wider text-[var(--color-indigo)]">
              04 Methodology · Protocol
            </p>
            <h2 className="mt-2 font-display text-4xl font-black uppercase text-[var(--color-ink)] sm:text-6xl">
              Three-Stage Firewall
            </h2>
            <p className="mt-2 font-serif-italic text-xl text-[var(--color-ink)]">
              Low friction when voice and device agree;{' '}
              <span className="underline decoration-[var(--color-indigo)] decoration-2 underline-offset-4">
                strict challenge
              </span>{' '}
              when anomalies appear.
            </p>
          </div>

          {!prefersReduced && (
            <div aria-hidden="true" className="mb-5 hidden md:block">
              <svg viewBox="0 0 900 18" className="h-4 w-full text-[var(--color-ink)]">
                <line
                  x1="24"
                  y1="9"
                  x2="876"
                  y2="9"
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeWidth="1"
                />
                <motion.path
                  d="M24 9 L876 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ pathLength: linePathLength }}
                />
              </svg>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {STEPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  initial={prefersReduced ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.3, delay: idx * 0.08 }}
                  className="flex flex-col"
                >
                  {/* Red step number on Paper header rule above each colored layer card */}
                  <div className="mb-3 flex items-baseline justify-between border-b border-[var(--color-ink)] pb-2">
                    <span className="font-display text-4xl font-black text-[var(--color-signal-red)]">
                      {item.step}
                    </span>
                    <span className="font-mono text-base font-medium uppercase text-[var(--color-ink)]">
                      {item.label}
                    </span>
                  </div>

                  <div
                    className={`flex h-full flex-col justify-between border border-[var(--color-ink)] p-6 ${item.surfaceClass}`}
                  >
                    <div>
                      <div className={`flex items-center justify-between gap-2 border-b pb-3 ${item.ruleClass}`}>
                        <span className="font-mono text-base font-semibold uppercase">
                          Stage {item.step}
                        </span>
                        <div className={`flex h-9 w-9 items-center justify-center border ${item.iconBorderClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <h3 className="mt-4 font-display text-3xl font-bold uppercase">
                        {item.title}
                      </h3>
                      <p className={`mt-2 text-base leading-relaxed ${item.subTextClass}`}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="mt-5 font-mono text-base text-[var(--color-ink)]/80">
            Fig. 4 — Enrollment, routine verification, and adaptive step-up sequence.
          </p>
        </div>
      </ScrollZoomSection>

      {/* 05 Interactive Simulator (Ink band) */}
      <TryItSimulator onBecomeActive={onBecomeActive} />

      {/* 06 Notes & FAQ: Blush background, Ink text, red question numbers, indigo filled chevron buttons */}
      <ScrollZoomSection
        id="faq"
        ariaLabel="Frequently asked notes"
        bandBackground="var(--color-blush)"
        bandText="var(--color-ink)"
        onBecomeActive={onBecomeActive}
      >
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="font-mono text-base font-semibold uppercase tracking-wider text-[var(--color-indigo)]">
              06 Documentation · FAQ
            </p>
            <h2 className="mt-2 font-display text-4xl font-black uppercase text-[var(--color-ink)] sm:text-6xl">
              Frequently Asked Notes
            </h2>
            <p className="mt-2 font-serif-italic text-xl text-[var(--color-ink)]">
              Clear answers regarding{' '}
              <span className="underline decoration-[var(--color-indigo)] decoration-2 underline-offset-4">
                vocal privacy
              </span>
              , fail-safes, and wearable checks.
            </p>
          </div>

          <BouncyAccordion items={FAQ_ITEMS} />

          <p className="mt-4 font-mono text-base text-[var(--color-ink)]/85">
            Fig. 6 — Operational notes on vocal privacy and fallback recovery controls.
          </p>

          {/* Conversion band */}
          <div className="mt-12 flex flex-col items-start justify-between gap-4 border border-[var(--color-ink)] bg-[var(--color-paper)] p-6 text-[var(--color-ink)] sm:flex-row sm:items-center sm:p-8">
            <div>
              <h3 className="font-display text-3xl font-black uppercase text-[var(--color-ink)]">
                Protect Your Voice
              </h3>
              <p className="mt-1 text-base text-[var(--color-ink)]/85">
                Enroll your vocal profile in minutes or sign in to the customer portal.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                onClick={onSignIn}
                className="border-[var(--color-ink)] bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
              >
                Sign in
              </Button>
              <Button
                onClick={onGetStarted}
                className="border-[var(--color-signal-red)] bg-[var(--color-signal-red)] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
              >
                Get started
              </Button>
            </div>
          </div>
        </div>
      </ScrollZoomSection>

      {/* Footer: Signal Red band with Ink text */}
      <footer className="border-t border-[var(--color-ink)] bg-[var(--color-signal-red)] text-[var(--color-ink)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 font-mono text-base font-medium text-[var(--color-ink)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-display text-2xl font-black uppercase text-[var(--color-ink)]">
              Sentinel
            </span>
            <span>Adaptive AI Voice Firewall</span>
            <span aria-hidden="true">·</span>
            <span>Interaction patterns inspired by Skiper UI</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/client"
              onClick={(e) => {
                e.preventDefault();
                onNavigateClient();
              }}
              className="border border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-1.5 font-mono text-base font-medium text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)] transition-colors"
            >
              Client console (/client)
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
