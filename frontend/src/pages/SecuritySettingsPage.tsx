import { useEffect, useState } from 'react';
import { apiClient, ApiError, type SecuritySettings } from '@/src/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';

interface SecuritySettingsPageProps {
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  onOfflineDetected: (offline: boolean) => void;
}

export function SecuritySettingsPage({ onToast, onOfflineDetected }: SecuritySettingsPageProps) {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getSecuritySettings()
      .then((res) => {
        setSettings(res);
        onOfflineDetected(false);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.isOffline) onOfflineDetected(true);
        onToast(err instanceof Error ? err.message : 'Unable to load security settings.', 'error');
      })
      .finally(() => setLoading(false));
  }, []);

  const updateSetting = async (patch: Partial<SecuritySettings>) => {
    if (!settings) return;
    const prev = settings;
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    try {
      const saved = await apiClient.updateSecuritySettings(patch);
      setSettings(saved);
      onToast('Security preferences saved', 'success');
    } catch (err) {
      setSettings(prev);
      if (err instanceof ApiError && err.isOffline) onOfflineDetected(true);
      onToast(err instanceof Error ? err.message : 'Could not update setting.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!settings) return null;

  const toggles: Array<{
    key: keyof Omit<SecuritySettings, 'requireStepUpAbove'>;
    title: string;
    description: string;
  }> = [
    {
      key: 'voiceProtectionEnabled',
      title: 'Adaptive Voice Firewall',
      description: 'Verify your voice and trusted device before completing spoken requests.',
    },
    {
      key: 'strictSyntheticGuard',
      title: 'Block synthetic and cloned speech',
      description: 'Automatically stop requests that sound artificial or recorded.',
    },
    {
      key: 'notifyOnBlocked',
      title: 'Instant blocked-attempt alerts',
      description: 'Notify you right away whenever Sentinel blocks an unusual command.',
    },
    {
      key: 'smartGlassesSync',
      title: 'Smart glasses hands-free verification',
      description: 'Allow voice checks through your paired wearable glasses.',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div className="border-b border-[var(--ink)] pb-4">
        <p className="font-mono text-base font-medium uppercase text-[var(--ink-muted)]">
          Policy Controls
        </p>
        <h1 className="mt-1 font-display text-4xl font-black uppercase text-[var(--ink)] sm:text-5xl">
          Security Settings
        </h1>
        <p className="mt-1 font-serif-italic text-xl text-[var(--ink-muted)]">
          Configure thresholds and wearable safeguards across your account.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-[var(--ink)]">
          <CardTitle className="text-3xl font-black">Voice safeguards</CardTitle>
          <CardDescription className="font-serif-italic text-lg">
            Changes apply immediately across connected devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-[var(--ink)] pt-2">
          {toggles.map((item) => {
            const checked = settings[item.key];
            return (
              <div key={item.key} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-base font-medium text-[var(--ink)]">{item.title}</p>
                  <p className="mt-0.5 text-base text-[var(--ink-muted)]">{item.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={item.title}
                  onClick={() => updateSetting({ [item.key]: !checked })}
                  className={`relative inline-flex h-7 w-13 shrink-0 items-center border border-[var(--ink)] p-0.5 transition-colors cursor-pointer ${
                    checked ? 'bg-[var(--ink)]' : 'bg-[var(--bg-paper)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 border border-[var(--ink)] transition-transform ${
                      checked
                        ? 'translate-x-6 bg-[var(--bg-paper)]'
                        : 'translate-x-0 bg-[var(--ink)]'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-[var(--ink)]">
          <CardTitle className="text-3xl font-black">Step-up threshold</CardTitle>
          <CardDescription className="font-serif-italic text-lg">
            Require your personal passphrase whenever a voice transfer exceeds this amount.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <span className="text-base text-[var(--ink-muted)]">Current threshold</span>
            <span className="font-mono text-2xl font-semibold text-[var(--ink)] tabular-nums">
              ${settings.requireStepUpAbove.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={5000}
            step={50}
            aria-label="Extra verification dollar threshold"
            value={settings.requireStepUpAbove}
            onChange={(e) => updateSetting({ requireStepUpAbove: Number(e.target.value) })}
            className="w-full accent-[var(--ink)]"
          />
          <div className="flex justify-between font-mono text-base text-[var(--ink-muted)]">
            <span>$100 (Strict)</span>
            <span>$5,000 (Relaxed)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
