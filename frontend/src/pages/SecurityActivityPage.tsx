import { useEffect, useState } from 'react';
import { Flag, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { apiClient, ApiError, type SecurityActivityItem } from '@/src/lib/api-client';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';
import { StatusBadge, type StatusKind } from '@/src/components/ui/StatusBadge';

interface SecurityActivityPageProps {
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  onOfflineDetected: (offline: boolean) => void;
}

function decisionMeta(decision: 'allow' | 'step_up' | 'block'): {
  kind: StatusKind;
  label: string;
} {
  if (decision === 'allow') return { kind: 'allow', label: 'Allow' };
  if (decision === 'step_up') return { kind: 'step_up', label: 'Step up' };
  return { kind: 'block', label: 'Block' };
}

export function SecurityActivityPage({ onToast, onOfflineDetected }: SecurityActivityPageProps) {
  const [items, setItems] = useState<SecurityActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingId, setReportingId] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getSecurityActivity()
      .then((res) => {
        setItems(res.items);
        onOfflineDetected(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.isOffline) onOfflineDetected(true);
        onToast(err instanceof Error ? err.message : 'Unable to load security activity.', 'error');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleReport = async (id: string) => {
    setReportingId(id);
    try {
      const { item } = await apiClient.reportUnauthorizedActivity(id);
      setItems((prev) => prev.map((entry) => (entry.id === id ? item : entry)));
      onToast('Reported. Extra safeguards enabled on your account.', 'info');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to report right now.', 'error');
    } finally {
      setReportingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="border-b border-[var(--ink)] pb-4">
        <p className="font-mono text-base font-medium uppercase text-[var(--ink-muted)]">
          Audit Log · Voice Checks
        </p>
        <h1 className="mt-1 font-display text-4xl font-black uppercase text-[var(--ink)] sm:text-5xl">
          Security Activity
        </h1>
        <p className="mt-1 font-serif-italic text-xl text-[var(--ink-muted)]">
          Inspect each voice evaluation and flag any activity you do not recognize.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-base text-[var(--ink-muted)]">
            No voice checks recorded yet. Try speaking or typing a request on your Dashboard.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const Icon =
              item.decision === 'allow'
                ? ShieldCheck
                : item.decision === 'step_up'
                ? KeyRound
                : ShieldAlert;
            const meta = decisionMeta(item.decision);

            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center border ${
                        item.decision === 'block'
                          ? 'border-[var(--accent-red)] text-[var(--accent-red)]'
                          : 'border-[var(--ink)] text-[var(--ink)]'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-mono text-base text-[var(--ink-muted)]">
                        <StatusBadge kind={meta.kind} label={meta.label} />
                        <span>{item.channel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                      <h2 className="mt-2 font-display text-2xl font-bold uppercase text-[var(--ink)]">
                        {item.actionSummary}
                      </h2>
                      <p className="mt-1 text-base text-[var(--ink-muted)]">
                        {item.explanation}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {item.reportedUnauthorized ? (
                      <StatusBadge kind="block" label="Flagged" />
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={reportingId === item.id}
                        onClick={() => handleReport(item.id)}
                      >
                        <Flag className="h-4 w-4" />
                        {reportingId === item.id ? 'Reporting...' : "This wasn't me"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
