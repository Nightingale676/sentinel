import { useEffect, useState } from 'react';
import { apiClient, type PublicStats } from '@/src/lib/api-client';
import { AnimatedNumber } from './skiper/AnimatedNumber';
import { ScrollZoomSection } from './ScrollZoomSection';

const FALLBACK_STATS: PublicStats = {
  requestsProtected: 482000,
  threatsBlocked: 19400,
  avgDecisionMs: 140,
  isDemo: true,
  updatedAt: new Date().toISOString(),
};

interface LiveStatsStripProps {
  onBecomeActive?: (bandBackground: string) => void;
}

export function LiveStatsStrip({ onBecomeActive }: LiveStatsStripProps) {
  const [stats, setStats] = useState<PublicStats>(FALLBACK_STATS);
  const [isFallback, setIsFallback] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await apiClient.getPublicStats();
        if (active) {
          setStats(data);
          setIsFallback(Boolean(data.isDemo));
        }
      } catch {
        if (active) {
          setIsFallback(true);
        }
      }
    };

    load();
    const interval = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <ScrollZoomSection
      ariaLabel="Protection benchmarks"
      bandBackground="var(--color-ink)"
      bandText="var(--color-paper)"
      onBecomeActive={onBecomeActive}
      className="border-[var(--color-paper)]/20"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="border border-[var(--color-paper)]/30 bg-[var(--color-ink)] p-6 sm:p-8">
          <div className="flex flex-col gap-2 border-b border-[var(--color-paper)]/25 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="mt-1 font-display text-4xl font-black uppercase text-[var(--color-paper)] sm:text-5xl">
                Verification Metrics
              </h2>
            </div>
            <p className="font-mono text-base text-[var(--color-paper)]/80">
              {isFallback ? 'Demo values · Sample benchmark dataset' : 'Live sample feed · 10s interval'}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 divide-y divide-[var(--color-paper)]/25 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="pt-4 first:pt-0 sm:pt-0 sm:pr-6">
              <div className="font-mono text-4xl font-semibold tracking-tight text-[var(--color-paper)] tabular-nums">
                <AnimatedNumber value={stats.requestsProtected} />
              </div>
              <p className="mt-1.5 text-base text-[var(--color-paper)]/80">
                Voice requests evaluated (Demo value)
              </p>
            </div>

            <div className="pt-4 sm:pt-0 sm:px-6">
              <div className="font-mono text-4xl font-semibold tracking-tight text-[var(--color-signal-red)] tabular-nums">
                <AnimatedNumber value={stats.threatsBlocked} />
              </div>
              <p className="mt-1.5 text-base text-[var(--color-paper)]/80">
                Synthetic clones blocked (Demo value)
              </p>
            </div>

            <div className="pt-4 sm:pt-0 sm:pl-6">
              <div className="font-mono text-4xl font-semibold tracking-tight text-[var(--color-paper)] tabular-nums">
                <AnimatedNumber value={stats.avgDecisionMs} suffix=" ms" />
              </div>
              <p className="mt-1.5 text-base text-[var(--color-paper)]/80">
                Median verification latency (Demo value)
              </p>
            </div>
          </div>

        </div>
      </div>
    </ScrollZoomSection>
  );
}
