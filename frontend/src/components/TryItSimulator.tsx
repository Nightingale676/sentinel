import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  evaluateSimulatorScenario,
  type SimulatorScenarioId,
} from '@/src/lib/sentinel-logic';
import { StatusBadge, type StatusKind } from './ui/StatusBadge';
import { ScrollZoomSection } from './ScrollZoomSection';

const SCENARIOS: Array<{ id: SimulatorScenarioId; label: string; hint: string }> = [
  { id: 'genuine', label: 'Genuine voice', hint: 'Routine electric bill' },
  { id: 'cloned', label: 'Cloned voice', hint: 'Synthetic urgent wire' },
  { id: 'risky', label: 'Risky request', hint: 'Large transfer to new payee' },
];

function decisionToBadge(decision: 'allow' | 'step_up' | 'block'): {
  kind: StatusKind;
  label: string;
} {
  if (decision === 'allow') return { kind: 'allow', label: 'Allow' };
  if (decision === 'step_up') return { kind: 'step_up', label: 'Step up' };
  return { kind: 'block', label: 'Block' };
}

interface TryItSimulatorProps {
  onBecomeActive?: (bandBackground: string) => void;
}

export function TryItSimulator({ onBecomeActive }: TryItSimulatorProps) {
  const prefersReduced = useReducedMotion();
  const [selected, setSelected] = useState<SimulatorScenarioId>('genuine');
  const result = evaluateSimulatorScenario(selected);
  const badge = decisionToBadge(result.decision);

  const resultGlowStyle =
    result.decision === 'allow'
      ? { boxShadow: '0 0 36px rgba(47, 166, 106, 0.28)' }
      : result.decision === 'step_up'
      ? { boxShadow: '0 0 36px rgba(242, 169, 59, 0.28)' }
      : { boxShadow: '0 0 36px rgba(229, 67, 46, 0.34)' };

  const resultBorderClass =
    result.decision === 'allow'
      ? 'border-[var(--color-green)]'
      : result.decision === 'step_up'
      ? 'border-[var(--color-amber)]'
      : 'border-[var(--color-signal-red)]';

  return (
    <ScrollZoomSection
      id="simulator"
      ariaLabel="Interactive firewall response simulator"
      bandBackground="var(--color-ink)"
      bandText="var(--color-paper)"
      onBecomeActive={onBecomeActive}
      className="border-[var(--color-paper)]/20"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="border border-[var(--color-paper)]/30 bg-[var(--color-ink)] p-6 sm:p-10">
          <div className="border-b border-[var(--color-paper)]/25 pb-5">
            <h2 className="mt-2 font-display text-4xl font-black uppercase text-[var(--color-paper)] sm:text-6xl">
              Firewall Response Test
            </h2>
            <p className="mt-2 font-serif-italic text-xl text-[var(--color-paper)]/90">
              Select a{' '}
              <span className="underline decoration-[var(--color-green)] decoration-2 underline-offset-4">
                speech condition
              </span>{' '}
              below to inspect how acoustic, context, and risk layers resolve.
            </p>
          </div>

          {/* Scenario buttons */}
          <div
            role="tablist"
            aria-label="Voice simulator scenarios"
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {SCENARIOS.map((item) => {
              const isActive = selected === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelected(item.id)}
                  className={`flex flex-col items-start border px-4 py-3.5 text-left transition-colors cursor-pointer ${
                    isActive
                      ? 'border-[var(--color-paper)] bg-[var(--color-paper)] text-[var(--color-ink)]'
                      : 'border-[var(--color-paper)]/45 bg-[var(--color-ink)] text-[var(--color-paper)] hover:border-[var(--color-indigo)] hover:bg-[var(--color-indigo)] hover:text-[var(--color-paper)]'
                  }`}
                >
                  <span className="font-display text-2xl font-bold uppercase">{item.label}</span>
                  <span
                    className={`mt-1 text-base ${
                      isActive ? 'text-[var(--color-ink)]/80' : 'text-[var(--color-paper)]/80'
                    }`}
                  >
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Animated decision & 3-layer bars with Allow green, Step up amber, Block red */}
          <AnimatePresence mode="wait">
            <motion.div
              key={result.id}
              initial={prefersReduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              style={resultGlowStyle}
              className={`mt-6 grid grid-cols-1 gap-6 border ${resultBorderClass} bg-[var(--color-ink)] p-5 sm:p-6 lg:grid-cols-12`}
            >
              <div className="flex flex-col justify-between gap-4 lg:col-span-5">
                <div>
                  <div className="font-mono text-base uppercase text-[var(--color-paper)]/75">
                    Transcript Specimen (Simulated)
                  </div>
                  <blockquote className="mt-2 font-serif-italic text-2xl leading-snug text-[var(--color-paper)]">
                    “{result.transcript}”
                  </blockquote>
                </div>

                <div className="border-t border-[var(--color-paper)]/25 pt-4">
                  <div className="flex items-center gap-3">
                    <StatusBadge kind={badge.kind} tone="vivid" label={badge.label} />
                    <span className="font-mono text-base text-[var(--color-paper)]/85">
                      {result.decisionLabel}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-3xl font-bold uppercase text-[var(--color-paper)]">
                    {result.headline}
                  </h3>
                  <p className="mt-1.5 text-base leading-relaxed text-[var(--color-paper)]/85">
                    {result.explanation}
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-4 lg:col-span-7">
                {result.layers.map((layer) => {
                  const barColor =
                    layer.tone === 'danger'
                      ? 'bg-[var(--color-signal-red)]'
                      : layer.tone === 'caution'
                      ? 'bg-[var(--color-amber)]'
                      : 'bg-[var(--color-green)]';

                  return (
                    <div
                      key={layer.label}
                      className="border border-[var(--color-paper)]/30 bg-[var(--color-ink)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-base">
                        <span className="font-mono font-medium uppercase text-[var(--color-paper)]">
                          {layer.label}
                        </span>
                        <span className="text-base text-[var(--color-paper)]/85">{layer.summary}</span>
                      </div>
                      <div className="mt-3 h-3 w-full overflow-hidden border border-[var(--color-paper)]/40 bg-[var(--color-ink)]">
                        <motion.div
                          initial={prefersReduced ? false : { scaleX: 0 }}
                          animate={{ scaleX: layer.fillPercent / 100 }}
                          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                          style={{ transformOrigin: 'left center' }}
                          className={`h-full w-full ${barColor}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

        </div>
      </div>
    </ScrollZoomSection>
  );
}
