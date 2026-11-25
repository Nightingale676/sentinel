import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AppWindow,
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  LayoutGrid,
  LogOut,
  MicOff,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  clientApi,
  type ClientSessionUser,
  type ClientSummaryDTO,
  type ClientTransactionDTO,
} from '@/src/lib/client-api';
import type { PublicClientApp, PublicClientVoice } from '@/src/lib/client-portal-service';
import { formatCompactInr, formatInr } from '@/src/lib/inr';
import { StatusBadge, type StatusKind } from '@/src/components/ui/StatusBadge';
import { Button } from '@/src/components/ui/button';
import { Skeleton } from '@/src/components/ui/skeleton';

export type ClientSectionId = 'overview' | 'transactions' | 'voices' | 'apps';

interface ClientDashboardPageProps {
  onNavigateHome: () => void;
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
}

const RAIL_ITEMS: Array<{ id: ClientSectionId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'transactions', label: 'Transactions', icon: Activity },
  { id: 'voices', label: 'Voices', icon: Users },
  { id: 'apps', label: 'Apps', icon: AppWindow },
];

function txStatusToKind(status: ClientTransactionDTO['status']): StatusKind {
  if (status === 'Allowed') return 'allow';
  if (status === 'Suspicious') return 'step_up';
  return 'block';
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatAppType(type: PublicClientApp['type']): string {
  if (type === 'mobile_app') return 'Mobile App';
  if (type === 'call_center') return 'Call Center';
  return 'Assistant';
}

interface DailyLineChartProps {
  series: ClientSummaryDTO['dailySeries'];
}

function DailyTransactionsLineChart({ series }: DailyLineChartProps) {
  const titleId = useId();
  if (!series || series.length === 0) {
    return (
      <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-6 font-mono text-base text-[var(--ink-muted)]">
        No daily transaction data in this window.
      </div>
    );
  }

  const width = 760;
  const height = 220;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxTotal = Math.max(1, ...series.map((d) => d.total));
  const yCeiling = Math.ceil(maxTotal * 1.15);

  const toX = (idx: number) =>
    series.length === 1 ? padLeft + plotW / 2 : padLeft + (idx / (series.length - 1)) * plotW;
  const toY = (val: number) => padTop + plotH - (val / yCeiling) * plotH;

  const totalPath = series
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(pt.total).toFixed(1)}`)
    .join(' ');
  const blockedPath = series
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(pt.blocked).toFixed(1)}`)
    .join(' ');

  const midTick = Math.round(yCeiling / 2);
  const firstDate = series[0]?.date.slice(5) ?? '';
  const midDate = series[Math.floor(series.length / 2)]?.date.slice(5) ?? '';
  const lastDate = series[series.length - 1]?.date.slice(5) ?? '';

  return (
    <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ink)] pb-3">
        <div>
          <h3 className="font-display text-2xl font-bold uppercase text-[var(--ink)]">
            Daily Voice Checks vs. Blocked
          </h3>
          <p className="font-serif-italic text-base text-[var(--ink-muted)]">
            Daily aggregate count across connected channels.
          </p>
        </div>
        <div className="flex items-center gap-5 font-mono text-base">
          <span className="inline-flex items-center gap-2 text-[var(--ink)]">
            <span className="inline-block h-0.5 w-5 bg-[var(--ink)]" aria-hidden="true" />
            All transactions
          </span>
          <span className="inline-flex items-center gap-2 text-[var(--accent-red)] font-semibold">
            <span className="inline-block h-0.5 w-5 bg-[var(--accent-red)]" aria-hidden="true" />
            Blocked
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <svg
          role="img"
          aria-labelledby={titleId}
          viewBox={`0 0 ${width} ${height}`}
          className="h-56 w-full min-w-[460px]"
        >
          <title id={titleId}>Daily transaction count and blocked count chart</title>
          {[0, midTick, yCeiling].map((tickVal) => {
            const y = toY(tickVal);
            return (
              <g key={tickVal}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#141414"
                  strokeOpacity="0.18"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#141414"
                  fontSize="11"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          <path d={totalPath} fill="none" stroke="#141414" strokeWidth="2.2" strokeLinejoin="round" />
          <path d={blockedPath} fill="none" stroke="#B5473A" strokeWidth="2.4" strokeLinejoin="round" />

          {series.map((pt, idx) => {
            if (series.length <= 15 || idx % 5 === 0 || idx === series.length - 1) {
              return (
                <g key={pt.date}>
                  <circle cx={toX(idx)} cy={toY(pt.total)} r="2.8" fill="#141414" />
                  <circle cx={toX(idx)} cy={toY(pt.blocked)} r="2.8" fill="#B5473A" />
                </g>
              );
            }
            return null;
          })}

          <text
            x={padLeft}
            y={height - 10}
            textAnchor="start"
            fill="#141414"
            fontSize="11"
            fontFamily="IBM Plex Mono, monospace"
          >
            {firstDate}
          </text>
          <text
            x={padLeft + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            fill="#141414"
            fontSize="11"
            fontFamily="IBM Plex Mono, monospace"
          >
            {midDate}
          </text>
          <text
            x={width - padRight}
            y={height - 10}
            textAnchor="end"
            fill="#141414"
            fontSize="11"
            fontFamily="IBM Plex Mono, monospace"
          >
            {lastDate}
          </text>
        </svg>
      </div>
      <p className="mt-2 font-mono text-base text-[var(--ink-muted)]">
        Fig. C1 — Daily request volume and Sentinel-blocked events over the selected window.
      </p>
    </div>
  );
}

export function ClientDashboardPage({ onNavigateHome, onToast }: ClientDashboardPageProps) {
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<ClientSectionId>('overview');

  // Overview state
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [summary, setSummary] = useState<ClientSummaryDTO | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Transactions state
  const [txTab, setTxTab] = useState<'all' | 'suspicious' | 'blocked'>('all');
  const [txQuery, setTxQuery] = useState('');
  const [txFrom, setTxFrom] = useState('');
  const [txTo, setTxTo] = useState('');
  const [txPage, setTxPage] = useState(1);
  const [txData, setTxData] = useState<{
    items: ClientTransactionDTO[];
    total: number;
    page: number;
    totalPages: number;
  }>({ items: [], total: 0, page: 1, totalPages: 1 });
  const [txLoading, setTxLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<ClientTransactionDTO | null>(null);

  // Voices state
  const [voices, setVoices] = useState<PublicClientVoice[]>([]);
  const [voicesTotal, setVoicesTotal] = useState(0);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceConfirm, setVoiceConfirm] = useState<{
    mode: 're-enroll' | 'delete';
    voice: PublicClientVoice;
  } | null>(null);
  const [voiceMutationBusy, setVoiceMutationBusy] = useState(false);

  // Apps state
  const [apps, setApps] = useState<PublicClientApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [rotateConfirmApp, setRotateConfirmApp] = useState<PublicClientApp | null>(null);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [revealedKeyOnce, setRevealedKeyOnce] = useState<{
    appName: string;
    apiKeyOnce: string;
    rotatedAt: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Escape closes modals / slide-overs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (voiceConfirm) setVoiceConfirm(null);
        else if (rotateConfirmApp) setRotateConfirmApp(null);
        else if (selectedTx) setSelectedTx(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [voiceConfirm, rotateConfirmApp, selectedTx]);

  useEffect(() => {
    clientApi
      .getSession()
      .then((res) => setSessionUser(res.user))
      .catch(() => setSessionUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  const loadSummary = useCallback(
    async (days: 7 | 30 | 90) => {
      setSummaryLoading(true);
      try {
        const res = await clientApi.getSummary(days);
        setSummary(res);
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Unable to load summary.', 'error');
      } finally {
        setSummaryLoading(false);
      }
    },
    [onToast]
  );

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await clientApi.getTransactions({
        tab: txTab,
        q: txQuery.trim() || undefined,
        from: txFrom || undefined,
        to: txTo || undefined,
        page: txPage,
        limit: 12,
      });
      setTxData({
        items: res.items,
        total: res.total,
        page: res.page,
        totalPages: res.totalPages,
      });
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to load transactions.', 'error');
    } finally {
      setTxLoading(false);
    }
  }, [txTab, txQuery, txFrom, txTo, txPage, onToast]);

  const loadVoices = useCallback(async () => {
    setVoicesLoading(true);
    try {
      const res = await clientApi.getVoices();
      setVoices(res.items);
      setVoicesTotal(res.totalCount);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to load voice profiles.', 'error');
    } finally {
      setVoicesLoading(false);
    }
  }, [onToast]);

  const loadApps = useCallback(async () => {
    setAppsLoading(true);
    try {
      const res = await clientApi.getApps();
      setApps(res.items);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to load connected apps.', 'error');
    } finally {
      setAppsLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (!sessionUser) return;
    if (activeSection === 'overview') {
      loadSummary(rangeDays);
    } else if (activeSection === 'transactions') {
      loadTransactions();
    } else if (activeSection === 'voices') {
      loadVoices();
    } else if (activeSection === 'apps') {
      loadApps();
    }
  }, [sessionUser, activeSection, rangeDays, loadSummary, loadTransactions, loadVoices, loadApps]);

  const handleLogin = async (loginEmail: string, loginPass: string) => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      const res = await clientApi.login(loginEmail.trim(), loginPass);
      setSessionUser(res.user);
      setActiveSection('overview');
      onToast(`Signed in to ${res.user.organizationName}`, 'success');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Invalid credentials.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await clientApi.logout();
    } catch {
      // ignore
    }
    setSessionUser(null);
    setSummary(null);
    setTxData({ items: [], total: 0, page: 1, totalPages: 1 });
    setVoices([]);
    setApps([]);
    setRevealedKeyOnce(null);
    onToast('Signed out of Client Console', 'info');
  };

  const handleOpenTransactionDetail = async (tx: ClientTransactionDTO) => {
    setSelectedTx(tx);
    try {
      const fresh = await clientApi.getTransactionById(tx.id);
      setSelectedTx(fresh.item);
    } catch {
      // keep existing row summary if refetch fails
    }
  };

  const handleConfirmVoiceAction = async () => {
    if (!voiceConfirm) return;
    setVoiceMutationBusy(true);
    try {
      if (voiceConfirm.mode === 're-enroll') {
        const res = await clientApi.requestVoiceReenroll(voiceConfirm.voice.id);
        setVoices((prev) => prev.map((v) => (v.id === res.item.id ? res.item : v)));
        onToast(`Re-enrollment requested for ${res.item.customerRefMasked}`, 'success');
      } else {
        const res = await clientApi.deleteVoice(voiceConfirm.voice.id);
        setVoices((prev) => prev.filter((v) => v.id !== res.deletedId));
        setVoicesTotal((c) => Math.max(0, c - 1));
        onToast('Enrolled voice signature removed', 'success');
      }
      setVoiceConfirm(null);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Voice action failed.', 'error');
    } finally {
      setVoiceMutationBusy(false);
    }
  };

  const handleConfirmRotateKey = async () => {
    if (!rotateConfirmApp) return;
    setRotateBusy(true);
    try {
      const res = await clientApi.rotateAppKey(rotateConfirmApp.id);
      setRevealedKeyOnce({
        appName: res.appName,
        apiKeyOnce: res.apiKeyOnce,
        rotatedAt: res.rotatedAt,
      });
      setCopiedKey(false);
      setRotateConfirmApp(null);
      await loadApps();
      onToast(`Rotated API key for ${res.appName}. Save it now — shown once.`, 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Key rotation failed.', 'error');
    } finally {
      setRotateBusy(false);
    }
  };

  const handleCopyOneTimeKey = async () => {
    if (!revealedKeyOnce) return;
    try {
      await navigator.clipboard.writeText(revealedKeyOnce.apiKeyOnce);
      setCopiedKey(true);
      onToast('API key copied to clipboard', 'success');
    } catch {
      onToast('Copy failed — select and copy the key manually.', 'error');
    }
  };

  const isAdmin = sessionUser?.role === 'client_admin';

  const statusCountsNote = useMemo(() => {
    if (!summary) return '';
    return `Window: last ${summary.days} days`;
  }, [summary]);

  if (checkingAuth) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="mt-6 h-72 w-full" />
      </div>
    );
  }

  // Client Sign-In Gate
  if (!sessionUser) {
    return (
      <section
        aria-label="Sentinel Client Dashboard Sign In"
        className="mx-auto max-w-2xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <div className="mb-6">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 font-mono text-base text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Sentinel</span>
          </button>
        </div>

        <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-6 sm:p-8">
          <p className="font-mono text-base uppercase tracking-wider text-[var(--accent-red)]">
            Client Console · /client
          </p>
          <h1 className="mt-2 font-display text-5xl font-black uppercase text-[var(--ink)]">
            Enterprise Voice Protection
          </h1>
          <p className="mt-2 font-serif-italic text-xl text-[var(--ink-muted)]">
            Sign in with your organization account to inspect INR voice transactions, enrolled customer voices, and connected app channels.
          </p>

          {loginError && (
            <div
              role="alert"
              className="mt-5 border border-[var(--accent-red)] bg-[var(--accent-red)] px-4 py-3 font-mono text-base text-[var(--bg-paper)]"
            >
              {loginError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin(email, password);
            }}
            className="mt-6 space-y-4"
          >
            <div>
              <label htmlFor="client-email" className="block font-mono text-base font-medium text-[var(--ink)]">
                Work email
              </label>
              <input
                id="client-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@aarohanbank.in"
                className="mt-1.5 min-h-[44px] w-full border border-[var(--ink)] bg-[var(--bg-paper)] px-3 text-base text-[var(--ink)] focus:border-[var(--accent-red)] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="client-password" className="block font-mono text-base font-medium text-[var(--ink)]">
                Password
              </label>
              <input
                id="client-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter organization password"
                className="mt-1.5 min-h-[44px] w-full border border-[var(--ink)] bg-[var(--bg-paper)] px-3 text-base text-[var(--ink)] focus:border-[var(--accent-red)] focus:outline-none"
              />
            </div>

            <Button type="submit" disabled={loginBusy} className="w-full sm:w-auto">
              {loginBusy ? 'Signing in...' : 'Sign in to client console'}
            </Button>
          </form>

          <div className="mt-8 border-t border-[var(--ink)] pt-6">
            <p className="font-mono text-base font-medium uppercase text-[var(--ink)]">
              Demo Organization Accounts (Aarohan Bank India)
            </p>
            <p className="mt-1 text-base text-[var(--ink-muted)]">
              Explore role-based access as an administrator or as a read-only viewer.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={loginBusy}
                onClick={() => {
                  setEmail('admin@aarohanbank.in');
                  setPassword('SentinelClient2026!');
                  handleLogin('admin@aarohanbank.in', 'SentinelClient2026!');
                }}
              >
                Demo Admin (admin@aarohanbank.in)
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loginBusy}
                onClick={() => {
                  setEmail('viewer@aarohanbank.in');
                  setPassword('SentinelViewer2026!');
                  handleLogin('viewer@aarohanbank.in', 'SentinelViewer2026!');
                }}
              >
                Demo Viewer (viewer@aarohanbank.in)
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg-paper)] text-[var(--ink)]">
      {/* Workspace Context Bar */}
      <div className="border-b border-[var(--ink)] bg-[var(--bg-paper)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex items-center gap-1.5 border border-[var(--ink)] px-3 py-1 font-mono text-base text-[var(--ink)] hover:bg-[var(--ink-subtle)] cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Site</span>
            </button>
            <div>
              <p className="font-mono text-base uppercase tracking-wider text-[var(--ink-muted)]">
                Client Console · {sessionUser.organization_id}
              </p>
              <h1 className="font-display text-3xl font-black uppercase text-[var(--ink)] sm:text-4xl">
                {sessionUser.organizationName}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="border border-[var(--ink)] px-3 py-1 font-mono text-base font-medium uppercase text-[var(--ink)]">
              {isAdmin ? 'Client Admin' : 'Client Viewer · Read only'}
            </span>
            <span className="hidden font-mono text-base text-[var(--ink-muted)] sm:inline">
              {sessionUser.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Slim Left Rail + Primary Workspace */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:px-8">
        <aside aria-label="Client dashboard sections" className="lg:col-span-3">
          <nav className="flex flex-row flex-wrap gap-2 lg:flex-col">
            {RAIL_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-[44px] items-center gap-3 border px-4 py-2.5 text-left font-mono text-base font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bg-paper)]'
                      : 'border-[var(--ink)] bg-[var(--bg-paper)] text-[var(--ink)] hover:bg-[var(--ink-subtle)]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 border border-[var(--ink)] p-4">
            <p className="font-mono text-base font-medium uppercase text-[var(--ink)]">
              Status Definitions
            </p>
            <dl className="mt-3 space-y-2.5 text-base">
              <div>
                <dt className="font-mono font-semibold text-[var(--ink)]">Blocked</dt>
                <dd className="text-[var(--ink-muted)]">Stopped by Sentinel prior to execution.</dd>
              </div>
              <div>
                <dt className="font-mono font-semibold text-[var(--ink)]">Suspicious</dt>
                <dd className="text-[var(--ink-muted)]">
                  Flagged and challenged; recorded as Verified or Not verified.
                </dd>
              </div>
              <div>
                <dt className="font-mono font-semibold text-[var(--ink)]">Allowed</dt>
                <dd className="text-[var(--ink-muted)]">Voice and device matched cleanly.</dd>
              </div>
            </dl>
          </div>
        </aside>

        <main className="min-w-0 lg:col-span-9">
          {/* SECTION 1: OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--ink)] pb-4">
                <div>
                  <p className="font-mono text-base uppercase tracking-wider text-[var(--ink-muted)]">
                    01 · Summary
                  </p>
                  <h2 className="mt-1 font-display text-4xl font-black uppercase text-[var(--ink)]">
                    Protection Overview
                  </h2>
                  {statusCountsNote && (
                    <p className="mt-1 font-serif-italic text-lg text-[var(--ink-muted)]">
                      {statusCountsNote} · All amounts reported in Indian Rupees (INR)
                    </p>
                  )}
                </div>

                <div role="group" aria-label="Time range" className="inline-flex border border-[var(--ink)]">
                  {([7, 30, 90] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setRangeDays(days)}
                      aria-pressed={rangeDays === days}
                      className={`min-h-[40px] px-4 font-mono text-base font-medium transition-colors cursor-pointer ${
                        rangeDays === days
                          ? 'bg-[var(--ink)] text-[var(--bg-paper)]'
                          : 'bg-[var(--bg-paper)] text-[var(--ink)] hover:bg-[var(--ink-subtle)]'
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>

              {summaryLoading || !summary ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-5">
                      <p className="font-mono text-base uppercase text-[var(--ink-muted)]">
                        Total transactions
                      </p>
                      <div className="mt-2 font-mono text-3xl font-semibold text-[var(--ink)] tabular-nums">
                        {summary.totalTransactions.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-5">
                      <p className="font-mono text-base uppercase text-[var(--ink-muted)]">
                        Total value
                      </p>
                      <div
                        title={formatInr(summary.totalValuePaise)}
                        className="mt-2 font-mono text-3xl font-semibold text-[var(--ink)] tabular-nums"
                      >
                        {formatCompactInr(summary.totalValuePaise)}
                      </div>
                      <p className="mt-1 font-mono text-base text-[var(--ink-muted)] tabular-nums">
                        {formatInr(summary.totalValuePaise)}
                      </p>
                    </div>

                    <div className="border border-[var(--accent-red)] bg-[var(--bg-paper)] p-5">
                      <p className="font-mono text-base font-semibold uppercase text-[var(--accent-red)]">
                        Blocked
                      </p>
                      <div className="mt-2 font-mono text-3xl font-semibold text-[var(--accent-red)] tabular-nums">
                        {summary.blockedCount.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-5">
                      <p className="font-mono text-base uppercase text-[var(--ink-muted)]">
                        Suspicious
                      </p>
                      <div className="mt-2 font-mono text-3xl font-semibold text-[var(--ink)] tabular-nums">
                        {summary.suspiciousCount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <DailyTransactionsLineChart series={summary.dailySeries} />

                  {/* Two 5-item lists */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-5">
                      <div className="flex items-center justify-between border-b border-[var(--ink)] pb-3">
                        <h3 className="font-display text-2xl font-bold uppercase text-[var(--accent-red)]">
                          Latest blocked
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setTxTab('blocked');
                            setTxPage(1);
                            setActiveSection('transactions');
                          }}
                          className="font-mono text-base underline underline-offset-4 hover:text-[var(--accent-red)] cursor-pointer"
                        >
                          View all
                        </button>
                      </div>
                      {summary.latestBlocked.length === 0 ? (
                        <p className="py-6 font-mono text-base text-[var(--ink-muted)]">
                          No blocked events in this period.
                        </p>
                      ) : (
                        <ul className="divide-y divide-[var(--ink)]">
                          {summary.latestBlocked.map((tx) => (
                            <li key={tx.id}>
                              <button
                                type="button"
                                onClick={() => handleOpenTransactionDetail(tx)}
                                className="flex w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:bg-[var(--ink-subtle)] cursor-pointer px-1"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium text-[var(--ink)] truncate">
                                    {tx.action} · {tx.customerRef}
                                  </div>
                                  <div className="font-mono text-base text-[var(--ink-muted)]">
                                    {tx.appName} · {formatDateTime(tx.timestamp)}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className="font-mono text-base font-semibold text-[var(--ink)] tabular-nums">
                                    {formatInr(tx.amountPaise)}
                                  </span>
                                  <StatusBadge kind="block" tone="research" label="Blocked" compact />
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-5">
                      <div className="flex items-center justify-between border-b border-[var(--ink)] pb-3">
                        <h3 className="font-display text-2xl font-bold uppercase text-[var(--ink)]">
                          Latest suspicious
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setTxTab('suspicious');
                            setTxPage(1);
                            setActiveSection('transactions');
                          }}
                          className="font-mono text-base underline underline-offset-4 hover:text-[var(--accent-red)] cursor-pointer"
                        >
                          View all
                        </button>
                      </div>
                      {summary.latestSuspicious.length === 0 ? (
                        <p className="py-6 font-mono text-base text-[var(--ink-muted)]">
                          No suspicious events in this period.
                        </p>
                      ) : (
                        <ul className="divide-y divide-[var(--ink)]">
                          {summary.latestSuspicious.map((tx) => (
                            <li key={tx.id}>
                              <button
                                type="button"
                                onClick={() => handleOpenTransactionDetail(tx)}
                                className="flex w-full items-start justify-between gap-3 py-3 text-left transition-colors hover:bg-[var(--ink-subtle)] cursor-pointer px-1"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium text-[var(--ink)] truncate">
                                    {tx.action} · {tx.customerRef}
                                  </div>
                                  <div className="font-mono text-base text-[var(--ink-muted)]">
                                    {tx.verificationOutcome ?? 'Challenged'} · {formatDateTime(tx.timestamp)}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className="font-mono text-base font-semibold text-[var(--ink)] tabular-nums">
                                    {formatInr(tx.amountPaise)}
                                  </span>
                                  <StatusBadge kind="step_up" tone="research" label="Suspicious" compact />
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SECTION 2: TRANSACTIONS */}
          {activeSection === 'transactions' && (
            <div className="space-y-6">
              <div className="border-b border-[var(--ink)] pb-4">
                <p className="font-mono text-base uppercase tracking-wider text-[var(--ink-muted)]">
                  02 · Audit Ledger
                </p>
                <h2 className="mt-1 font-display text-4xl font-black uppercase text-[var(--ink)]">
                  Transactions
                </h2>
                <p className="mt-1 text-base text-[var(--ink-muted)]">
                  Blocked = stopped by Sentinel. Suspicious = flagged and challenged (shown as Verified or Not verified). Select any row for detail.
                </p>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-col gap-4 border border-[var(--ink)] bg-[var(--bg-paper)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div role="tablist" aria-label="Transaction status tabs" className="inline-flex border border-[var(--ink)]">
                    {(['all', 'suspicious', 'blocked'] as const).map((tab) => (
                      <button
                        key={tab}
                        role="tab"
                        aria-selected={txTab === tab}
                        type="button"
                        onClick={() => {
                          setTxTab(tab);
                          setTxPage(1);
                        }}
                        className={`min-h-[40px] px-4 font-mono text-base font-medium uppercase transition-colors cursor-pointer ${
                          txTab === tab
                            ? 'bg-[var(--ink)] text-[var(--bg-paper)]'
                            : 'bg-[var(--bg-paper)] text-[var(--ink)] hover:bg-[var(--ink-subtle)]'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <span className="font-mono text-base text-[var(--ink-muted)] tabular-nums">
                    {txData.total} matching records
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="relative sm:col-span-6">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
                    <input
                      type="search"
                      aria-label="Search transactions"
                      value={txQuery}
                      onChange={(e) => {
                        setTxQuery(e.target.value);
                        setTxPage(1);
                      }}
                      placeholder="Search customer ref, app, action, or reason"
                      className="min-h-[42px] w-full border border-[var(--ink)] bg-[var(--bg-paper)] pr-3 pl-9 text-base text-[var(--ink)] focus:border-[var(--accent-red)] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="date"
                      aria-label="Filter from date"
                      value={txFrom}
                      onChange={(e) => {
                        setTxFrom(e.target.value);
                        setTxPage(1);
                      }}
                      className="min-h-[42px] w-full border border-[var(--ink)] bg-[var(--bg-paper)] px-3 font-mono text-base text-[var(--ink)] focus:border-[var(--accent-red)] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="date"
                      aria-label="Filter to date"
                      value={txTo}
                      onChange={(e) => {
                        setTxTo(e.target.value);
                        setTxPage(1);
                      }}
                      className="min-h-[42px] w-full border border-[var(--ink)] bg-[var(--bg-paper)] px-3 font-mono text-base text-[var(--ink)] focus:border-[var(--accent-red)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {txLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : txData.items.length === 0 ? (
                <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-8 text-center">
                  <p className="font-mono text-base text-[var(--ink)]">
                    No transactions match your current filters.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setTxTab('all');
                      setTxQuery('');
                      setTxFrom('');
                      setTxTo('');
                      setTxPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-[var(--ink)] bg-[var(--bg-paper)]">
                  <table className="w-full min-w-[780px] border-collapse text-left text-base">
                    <thead>
                      <tr className="border-b border-[var(--ink)] font-mono text-base uppercase text-[var(--ink)]">
                        <th className="px-4 py-3 font-medium">Time</th>
                        <th className="px-4 py-3 font-medium">App</th>
                        <th className="px-4 py-3 font-medium">Customer ref</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Plain language reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ink)]">
                      {txData.items.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => handleOpenTransactionDetail(tx)}
                          className="cursor-pointer transition-colors hover:bg-[var(--ink-subtle)]"
                        >
                          <td className="px-4 py-3 font-mono text-base whitespace-nowrap text-[var(--ink)]">
                            {formatDateTime(tx.timestamp)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[var(--ink)]">{tx.appName}</td>
                          <td className="px-4 py-3 font-mono whitespace-nowrap text-[var(--ink)]">
                            {tx.customerRef}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-[var(--ink)]">
                            {tx.action}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap text-[var(--ink)] tabular-nums">
                            {formatInr(tx.amountPaise)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <StatusBadge kind={txStatusToKind(tx.status)} tone="research" label={tx.status} compact />
                              {tx.status === 'Suspicious' && tx.verificationOutcome && (
                                <span className="font-mono text-xs text-[var(--ink-muted)]">
                                  {tx.verificationOutcome}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--ink-muted)]">{tx.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between border border-[var(--ink)] bg-[var(--bg-paper)] px-4 py-3">
                <span className="font-mono text-base text-[var(--ink)] tabular-nums">
                  Page {txData.page} of {txData.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={txPage <= 1 || txLoading}
                    onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={txPage >= txData.totalPages || txLoading}
                    onClick={() => setTxPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: VOICES */}
          {activeSection === 'voices' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--ink)] pb-4">
                <div>
                  <p className="font-mono text-base uppercase tracking-wider text-[var(--ink-muted)]">
                    03 · Biometric Registry
                  </p>
                  <h2 className="mt-1 font-display text-4xl font-black uppercase text-[var(--ink)]">
                    Enrolled Voices ({voicesTotal})
                  </h2>
                  <p className="mt-1 inline-flex items-center gap-2 text-base text-[var(--ink-muted)]">
                    <MicOff className="h-4 w-4 shrink-0" />
                    <span>
                      Stored server-side as non-reversible vocal embeddings. Audio recordings are never stored or playable.
                    </span>
                  </p>
                </div>
              </div>

              {!isAdmin && (
                <div className="border border-[var(--ink)] bg-[var(--ink-subtle)] px-4 py-3 font-mono text-base text-[var(--ink)]">
                  Read-only viewer role active: re-enrollment requests and deletions are disabled.
                </div>
              )}

              {voicesLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : voices.length === 0 ? (
                <div className="border border-[var(--ink)] p-8 text-center font-mono text-base text-[var(--ink-muted)]">
                  No enrolled voices found for this organization.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[var(--ink)] bg-[var(--bg-paper)]">
                  <table className="w-full min-w-[700px] border-collapse text-left text-base">
                    <thead>
                      <tr className="border-b border-[var(--ink)] font-mono text-base uppercase text-[var(--ink)]">
                        <th className="px-4 py-3 font-medium">Customer reference</th>
                        <th className="px-4 py-3 font-medium">Enrolled date</th>
                        <th className="px-4 py-3 font-medium">Last verified</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ink)]">
                      {voices.map((voice) => (
                        <tr key={voice.id}>
                          <td className="px-4 py-3 font-mono font-medium text-[var(--ink)]">
                            {voice.customerRefMasked}
                          </td>
                          <td className="px-4 py-3 font-mono text-[var(--ink-muted)]">
                            {formatDateOnly(voice.enrolledAt)}
                          </td>
                          <td className="px-4 py-3 font-mono text-[var(--ink-muted)]">
                            {formatDateOnly(voice.lastVerifiedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              kind={voice.status === 'Active' ? 'allow' : 'step_up'}
                              tone="research"
                              label={voice.status}
                              compact
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!isAdmin}
                                onClick={() => setVoiceConfirm({ mode: 're-enroll', voice })}
                                className="gap-1.5"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                <span>Re-enroll</span>
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={!isAdmin}
                                onClick={() => setVoiceConfirm({ mode: 'delete', voice })}
                                className="gap-1.5"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: APPS */}
          {activeSection === 'apps' && (
            <div className="space-y-6">
              <div className="border-b border-[var(--ink)] pb-4">
                <p className="font-mono text-base uppercase tracking-wider text-[var(--ink-muted)]">
                  04 · Connected Channels
                </p>
                <h2 className="mt-1 font-display text-4xl font-black uppercase text-[var(--ink)]">
                  Apps
                </h2>
                <p className="mt-1 text-base text-[var(--ink-muted)]">
                  API keys are never displayed after issuance. Administrators can rotate a key when credentials change.
                </p>
              </div>

              {revealedKeyOnce && (
                <div
                  role="region"
                  aria-label="New rotated API key"
                  className="border-2 border-[var(--accent-red)] bg-[var(--bg-paper)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-base font-semibold uppercase text-[var(--accent-red)]">
                        New API Key for {revealedKeyOnce.appName} — Shown Once
                      </p>
                      <p className="mt-1 text-base text-[var(--ink)]">
                        Store this secret in your server vault now. It cannot be viewed again after you dismiss this box.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevealedKeyOnce(null)}
                      aria-label="Dismiss API key notice"
                      className="border border-[var(--ink)] p-1.5 text-[var(--ink)] hover:bg-[var(--ink-subtle)] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <code className="flex-1 break-all border border-[var(--ink)] bg-[var(--ink-subtle)] px-3 py-2 font-mono text-base text-[var(--ink)]">
                      {revealedKeyOnce.apiKeyOnce}
                    </code>
                    <Button type="button" onClick={handleCopyOneTimeKey} className="gap-2 shrink-0">
                      {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span>{copiedKey ? 'Copied' : 'Copy key'}</span>
                    </Button>
                  </div>
                </div>
              )}

              {appsLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <div className="overflow-x-auto border border-[var(--ink)] bg-[var(--bg-paper)]">
                  <table className="w-full border-collapse text-left text-base">
                    <thead>
                      <tr className="border-b border-[var(--ink)] font-mono text-sm uppercase text-[var(--ink)]">
                        <th className="px-3 py-3 font-medium">Name</th>
                        <th className="px-3 py-3 font-medium">Type</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium text-right">Tx</th>
                        <th className="px-3 py-3 font-medium text-right">Blocked</th>
                        <th className="px-3 py-3 font-medium">Last active</th>
                        <th className="px-3 py-3 font-medium text-right">Credentials</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ink)]">
                      {apps.map((app) => (
                        <tr key={app.id}>
                          <td className="px-3 py-3 font-medium text-[var(--ink)] whitespace-nowrap">
                            {app.name}
                          </td>
                          <td className="px-3 py-3 font-mono text-sm text-[var(--ink-muted)] whitespace-nowrap">
                            {formatAppType(app.type)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <StatusBadge kind="allow" tone="research" label={app.status} compact />
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-[var(--ink)] whitespace-nowrap">
                            {app.transactionsCount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-[var(--accent-red)] whitespace-nowrap">
                            {app.blockedCount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3 font-mono text-sm text-[var(--ink-muted)] whitespace-nowrap">
                            {formatDateOnly(app.lastActiveAt)}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!isAdmin}
                              onClick={() => setRotateConfirmApp(app)}
                              className="gap-1.5"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              <span>Rotate key</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Transaction Detail Slide-Over (portaled to body above sticky top header) */}
      {selectedTx &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex justify-end bg-[#141414]/45"
            onClick={() => setSelectedTx(null)}
          >
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Transaction detail"
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-full max-w-md flex-col justify-between overflow-y-auto border-l border-[var(--ink)] bg-[var(--bg-paper)] p-6 text-[var(--ink)]"
            >
              <div>
                <div className="flex items-start justify-between gap-4 border-b border-[var(--ink)] pb-4">
                  <div>
                    <p className="font-mono text-base uppercase text-[var(--ink-muted)]">
                      {selectedTx.id}
                    </p>
                    <h3 className="mt-1 font-display text-3xl font-black uppercase text-[var(--ink)]">
                      {selectedTx.action}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTx(null)}
                    aria-label="Close transaction detail"
                    className="border border-[var(--ink)] p-2 text-[var(--ink)] hover:bg-[var(--ink-subtle)] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <StatusBadge
                    kind={txStatusToKind(selectedTx.status)}
                    tone="research"
                    label={selectedTx.status}
                  />
                  {selectedTx.status === 'Suspicious' && selectedTx.verificationOutcome && (
                    <span className="border border-[var(--ink)] px-3 py-1 font-mono text-base text-[var(--ink)]">
                      {selectedTx.verificationOutcome}
                    </span>
                  )}
                </div>

                <dl className="mt-6 divide-y divide-[var(--ink)] border-t border-b border-[var(--ink)]">
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="font-mono text-base text-[var(--ink-muted)]">Amount (INR)</dt>
                    <dd className="font-mono text-lg font-semibold text-[var(--ink)] tabular-nums">
                      {formatInr(selectedTx.amountPaise)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="font-mono text-base text-[var(--ink-muted)]">Timestamp</dt>
                    <dd className="font-mono text-base text-[var(--ink)]">
                      {formatDateTime(selectedTx.timestamp)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="font-mono text-base text-[var(--ink-muted)]">Channel App</dt>
                    <dd className="text-base font-medium text-[var(--ink)]">{selectedTx.appName}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="font-mono text-base text-[var(--ink-muted)]">Customer reference</dt>
                    <dd className="font-mono text-base text-[var(--ink)]">{selectedTx.customerRef}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="font-mono text-base text-[var(--ink-muted)]">Risk level</dt>
                    <dd
                      className={`font-mono text-base font-semibold uppercase ${
                        selectedTx.riskLevel === 'High' ? 'text-[var(--accent-red)]' : 'text-[var(--ink)]'
                      }`}
                    >
                      {selectedTx.riskLevel}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 space-y-4">
                  <div>
                    <h4 className="font-mono text-base font-semibold uppercase text-[var(--ink)]">
                      Plain language reason
                    </h4>
                    <p className="mt-1 text-base leading-relaxed text-[var(--ink)]">
                      {selectedTx.reason}
                    </p>
                  </div>
                  <div className="border border-[var(--ink)] p-4">
                    <h4 className="font-mono text-base font-semibold uppercase text-[var(--ink)]">
                      What happened next
                    </h4>
                    <p className="mt-1 text-base leading-relaxed text-[var(--ink)]">
                      {selectedTx.whatHappenedNext}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[var(--ink)] pt-4">
                <Button variant="outline" className="w-full" onClick={() => setSelectedTx(null)}>
                  Close detail panel
                </Button>
              </div>
            </aside>
          </div>,
          document.body
        )}

      {/* Voice Action Confirmation Modal */}
      {voiceConfirm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/45 p-4"
            onClick={() => !voiceMutationBusy && setVoiceConfirm(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirm voice action"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md border border-[var(--ink)] bg-[var(--bg-paper)] p-6 text-[var(--ink)]"
            >
              <div className="flex items-center gap-2 font-mono text-base font-semibold uppercase text-[var(--accent-red)]">
                <ShieldAlert className="h-5 w-5" />
                <span>
                  {voiceConfirm.mode === 'delete' ? 'Delete Enrolled Voice' : 'Request Re-Enrollment'}
                </span>
              </div>
              <p className="mt-3 text-base leading-relaxed text-[var(--ink)]">
                {voiceConfirm.mode === 'delete'
                  ? `Remove the stored vocal embedding for ${voiceConfirm.voice.customerRefMasked}? Voice authentication for this customer will pause until they enroll again.`
                  : `Flag ${voiceConfirm.voice.customerRefMasked} for fresh phrase calibration on their next session?`}
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  disabled={voiceMutationBusy}
                  onClick={() => setVoiceConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={voiceConfirm.mode === 'delete' ? 'danger' : 'primary'}
                  disabled={voiceMutationBusy}
                  onClick={handleConfirmVoiceAction}
                >
                  {voiceMutationBusy
                    ? 'Updating...'
                    : voiceConfirm.mode === 'delete'
                    ? 'Confirm delete'
                    : 'Confirm re-enrollment'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* App Key Rotation Confirmation Modal */}
      {rotateConfirmApp &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/45 p-4"
            onClick={() => !rotateBusy && setRotateConfirmApp(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirm API key rotation"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md border border-[var(--ink)] bg-[var(--bg-paper)] p-6 text-[var(--ink)]"
            >
              <div className="flex items-center gap-2 font-mono text-base font-semibold uppercase text-[var(--accent-red)]">
                <KeyRound className="h-5 w-5" />
                <span>Rotate API Key</span>
              </div>
              <p className="mt-3 text-base leading-relaxed text-[var(--ink)]">
                Rotating the key for <strong>{rotateConfirmApp.name}</strong> invalidates the previous credential. The new key will be displayed once immediately after rotation.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  disabled={rotateBusy}
                  onClick={() => setRotateConfirmApp(null)}
                >
                  Cancel
                </Button>
                <Button variant="danger" disabled={rotateBusy} onClick={handleConfirmRotateKey}>
                  {rotateBusy ? 'Rotating...' : 'Confirm key rotation'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
