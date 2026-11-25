import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { ArrowLeft, ArrowRight, Mic, Send } from 'lucide-react';
import { RollingText } from './skiper/RollingText';
import { Button } from './ui/button';
import { StatusBadge, type StatusKind } from './ui/StatusBadge';
import { evaluateVoiceCommand, type CommandEvaluationResult } from '@/src/lib/sentinel-logic';

const HERO_GLASSES_SRC = '/assets/aistudio/glasses_rayban_cutout.png';

interface MetaGlassesPortalHeroProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  isSignedIn?: boolean;
  onBecomeActive?: (bandBackground: string) => void;
}

interface PreviewActivityItem {
  id: string;
  label: string;
  amount: string;
  decisionLabel: string;
  kind: StatusKind;
  time: string;
}

const INITIAL_PREVIEW_ACTIVITY: PreviewActivityItem[] = [
  {
    id: 'act-1',
    label: 'Maya Lin · Studio split',
    amount: '-$60.00',
    decisionLabel: 'Allow',
    kind: 'allow',
    time: '00:02 ago',
  },
  {
    id: 'act-2',
    label: 'City Electric · Utility',
    amount: '-$84.00',
    decisionLabel: 'Allow',
    kind: 'allow',
    time: '12:00 ago',
  },
  {
    id: 'act-3',
    label: 'External Wire · Synthetic',
    amount: '$4,800.00',
    decisionLabel: 'Block',
    kind: 'block',
    time: '01:04 ago',
  },
];

const QUICK_COMMANDS = [
  { label: 'Pay $60 to Maya', command: 'Pay $60 to Maya from checking' },
  { label: 'Send $950 to Jordan', command: 'Send $950 to Jordan for studio gear' },
  { label: 'Cloned voice wire', command: 'Urgent wire $4,800 cloned voice bypass' },
];

function decisionToStatus(decision: CommandEvaluationResult['decision']): {
  kind: StatusKind;
  label: string;
} {
  if (decision === 'allow') return { kind: 'allow', label: 'Allow' };
  if (decision === 'step_up') return { kind: 'step_up', label: 'Step up' };
  return { kind: 'block', label: 'Block' };
}

export function MetaGlassesPortalHero({
  onGetStarted,
  onSignIn,
  isSignedIn = false,
  onBecomeActive,
}: MetaGlassesPortalHeroProps) {
  const motionReduced = useReducedMotion();
  const [mediaReduced, setMediaReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  const prefersReduced = Boolean(motionReduced || mediaReduced);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMediaReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMediaReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const sectionRef = useRef<HTMLElement>(null);
  const [inInterfaceStage, setInInterfaceStage] = useState(false);
  const [manualPortalOpen, setManualPortalOpen] = useState(false);
  const [warpPulseKey, setWarpPulseKey] = useState(0);
  const [isWarping, setIsWarping] = useState(false);
  const warpTimeoutRef = useRef<number | null>(null);

  const [commandInput, setCommandInput] = useState('Pay $60 to Maya from checking');
  const [evalResult, setEvalResult] = useState<CommandEvaluationResult>(() =>
    evaluateVoiceCommand({
      transcript: 'Pay $60 to Maya from checking',
      requireStepUpAbove: 500,
      strictSyntheticGuard: true,
      knownPayeeNames: ['Maya', 'City Electric', 'Alex'],
    })
  );
  const [passphraseInput, setPassphraseInput] = useState('');
  const [passphraseVerified, setPassphraseVerified] = useState(false);
  const [activityFeed, setActivityFeed] = useState<PreviewActivityItem[]>(INITIAL_PREVIEW_ACTIVITY);

  useEffect(() => {
    return () => {
      if (warpTimeoutRef.current !== null) {
        window.clearTimeout(warpTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !onBecomeActive || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onBecomeActive('var(--color-ink)');
          }
        }
      },
      { rootMargin: '-38% 0px -38% 0px', threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onBecomeActive]);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const tiltY = useSpring(pointerX, { stiffness: 90, damping: 20 });
  const tiltX = useSpring(pointerY, { stiffness: 90, damping: 20 });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 26,
    mass: 0.4,
  });

  useMotionValueEvent(smoothProgress, 'change', (latest) => {
    setInInterfaceStage(latest >= 0.44);
    if (latest < 0.25 && manualPortalOpen) {
      setManualPortalOpen(false);
    }
  });

  // Dimensional optical dive: zoom straight through right lens (47.4% 52.4%) of cutout smart glasses
  const heroCopyOpacity = useTransform(smoothProgress, [0, 0.22], [1, 0]);
  const heroCopyY = useTransform(smoothProgress, [0, 0.22], [0, -32]);
  const glassesScale = useTransform(smoothProgress, [0, 0.14, 0.44, 0.66], [1, 1.32, 5.2, 11.5]);
  const glassesY = useTransform(smoothProgress, [0, 0.44, 0.66], [0, 16, 28]);
  const glassesOpacity = useTransform(smoothProgress, [0, 0.42, 0.62], [1, 0.95, 0]);
  const reticlePathLength = useTransform(smoothProgress, [0.02, 0.34], [0, 1]);
  const axisOpacity = useTransform(smoothProgress, [0.02, 0.16, 0.48, 0.62], [0, 0.38, 0.38, 0]);
  const reticleOpacity = useTransform(smoothProgress, [0.02, 0.14, 0.48, 0.6], [0.55, 1, 0.95, 0]);

  // Dimensional tunnel layers expanding radially as you cross the lens threshold
  const tunnelOpacity = useTransform(smoothProgress, [0.14, 0.34, 0.54, 0.68], [0, 0.95, 0.85, 0]);
  const tunnelScale = useTransform(smoothProgress, [0.14, 0.68], [0.24, 4.4]);
  const tunnelRotate = useTransform(smoothProgress, [0.14, 0.68], [-8, 38]);
  const apertureFlashOpacity = useTransform(smoothProgress, [0.34, 0.46, 0.58], [0, 0.55, 0]);

  // Dimension portal emerging out of Z-depth through the lens
  const portalOpacity = useTransform(smoothProgress, [0.36, 0.56, 1], [0, 1, 1]);
  const portalScale = useTransform(smoothProgress, [0.36, 0.58, 1], [0.36, 1, 1]);
  const portalY = useTransform(smoothProgress, [0.36, 0.58, 1], [48, 0, 0]);
  const portalRotateX = useTransform(smoothProgress, [0.36, 0.58, 1], [16, 0, 0]);

  const isPortalInteractive = prefersReduced || inInterfaceStage || manualPortalOpen;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    pointerX.set((nx - 0.5) * 14);
    pointerY.set(-(ny - 0.5) * 10);
  };

  const handleEnterLensPortal = () => {
    setWarpPulseKey((k) => k + 1);
    setIsWarping(true);
    if (warpTimeoutRef.current !== null) {
      window.clearTimeout(warpTimeoutRef.current);
    }
    warpTimeoutRef.current = window.setTimeout(() => {
      setIsWarping(false);
    }, 820);

    setManualPortalOpen(true);
    setInInterfaceStage(true);
    if (!sectionRef.current || prefersReduced) return;
    const top = sectionRef.current.offsetTop;
    const scrollable = Math.max(0, sectionRef.current.offsetHeight - window.innerHeight);
    window.scrollTo({
      top: top + Math.round(scrollable * 0.72),
      behavior: 'smooth',
    });
  };

  const handleReturnToGlasses = () => {
    setIsWarping(false);
    setManualPortalOpen(false);
    setInInterfaceStage(false);
    if (!sectionRef.current) return;
    window.scrollTo({
      top: Math.max(0, sectionRef.current.offsetTop - 60),
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  };

  const runLiveCommand = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setCommandInput(clean);
    setPassphraseVerified(false);
    setPassphraseInput('');
    const result = evaluateVoiceCommand({
      transcript: clean,
      requireStepUpAbove: 500,
      strictSyntheticGuard: true,
      knownPayeeNames: ['Maya', 'City Electric', 'Alex'],
    });
    setEvalResult(result);

    const status = decisionToStatus(result.decision);
    const newItem: PreviewActivityItem = {
      id: `act-${Date.now()}`,
      label: result.recipient ? `${result.recipient} · Voice check` : clean.slice(0, 30),
      amount: result.amount ? `-$${result.amount.toLocaleString()}` : 'Check',
      decisionLabel: status.label,
      kind: status.kind,
      time: '00:00 ago',
    };
    setActivityFeed((prev) => [newItem, ...prev.slice(0, 2)]);
  };

  const handleVerifyPassphrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphraseInput.trim()) return;
    setPassphraseVerified(true);
    setEvalResult((prev) => ({
      ...prev,
      decision: 'allow',
      decisionLabel: 'Approved',
      message: 'Personal passphrase confirmed via wearable. Request approved.',
      requiresPassphrase: false,
    }));
  };

  const activeStatus = decisionToStatus(evalResult.decision);

  const renderLiveInterface = () => (
    <div
      data-testid="lens-interface-view"
      className="w-full max-w-5xl border border-[var(--color-ink)] bg-[var(--color-paper)] p-5 text-[var(--color-ink)] sm:p-7"
    >
      {/* Top Bar of revealed dimensional interface */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-ink)] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-base font-medium uppercase tracking-wider text-[var(--color-ink)]">
              Fig. 0B · Lens Dimension Workspace
            </span>
            <StatusBadge kind="allow" tone="vivid" label="Allow · Active" />
          </div>
          <h2 className="mt-1 font-display text-3xl font-black uppercase text-[var(--color-ink)] sm:text-4xl">
            Sentinel Wearable Portal
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!prefersReduced && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleReturnToGlasses}
              className="border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Glasses view</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onSignIn}
            className="border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
          >
            {isSignedIn ? 'Open portal' : 'Sign in'}
          </Button>
          <Button
            size="sm"
            onClick={onGetStarted}
            className="border-[var(--color-signal-red)] bg-[var(--color-signal-red)] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
          >
            Get started
          </Button>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border border-[var(--color-ink)] bg-[var(--color-paper)] p-4">
            <div>
              <span className="font-mono text-base text-[var(--color-ink)]/75">
                CHECKING · 4829 · DEMO ACCOUNT
              </span>
              <div className="mt-1 font-mono text-3xl font-semibold text-[var(--color-ink)] tabular-nums">
                $14,825.40
              </div>
            </div>
            <StatusBadge kind="allow" tone="vivid" label="Firewall Active" />
          </div>

          <div className="border border-[var(--color-ink)] bg-[var(--color-paper)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-base font-medium uppercase text-[var(--color-ink)]">
                Spoken request evaluator
              </span>
              <span className="font-mono text-base text-[var(--color-ink)]/75">
                Demo simulation
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runLiveCommand(commandInput);
              }}
              className="mt-3 flex flex-col gap-2 sm:flex-row"
            >
              <div className="relative flex-1">
                <Mic className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-ink)]" />
                <input
                  type="text"
                  aria-label="Speak or type a voice command"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  className="min-h-[44px] w-full border border-[var(--color-ink)] bg-[var(--color-paper)] pr-3 pl-9 text-base text-[var(--color-ink)] placeholder:text-[var(--color-ink)]/60 focus:border-[var(--color-signal-red)] focus:outline-none"
                  placeholder="Pay $60 to Maya"
                />
              </div>
              <Button
                type="submit"
                size="md"
                className="gap-2 shrink-0 border-[var(--color-signal-red)] bg-[var(--color-signal-red)] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
              >
                <Send className="h-4 w-4" />
                <span>Verify request</span>
              </Button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_COMMANDS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => runLiveCommand(preset.command)}
                  className="min-h-[40px] border border-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-1 font-mono text-base text-[var(--color-ink)] transition-colors hover:bg-[var(--color-indigo)] hover:text-[var(--color-paper)] cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div
              role="status"
              aria-live="polite"
              className={`mt-4 border p-4 ${
                evalResult.decision === 'block'
                  ? 'border-[var(--color-signal-red)] bg-[var(--color-paper)]'
                  : 'border-[var(--color-ink)] bg-[var(--color-paper)]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge kind={activeStatus.kind} tone="vivid" label={activeStatus.label} />
                <span className="font-mono text-base text-[var(--color-ink)]/80">
                  {evalResult.decisionLabel}
                </span>
              </div>
              <p className="mt-2.5 text-base leading-relaxed text-[var(--color-ink)]">
                {evalResult.message}
              </p>

              {evalResult.requiresPassphrase && !passphraseVerified && (
                <form onSubmit={handleVerifyPassphrase} className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={passphraseInput}
                    onChange={(e) => setPassphraseInput(e.target.value)}
                    placeholder="Enter personal passphrase"
                    aria-label="Personal passphrase"
                    className="min-h-[40px] flex-1 border border-[var(--color-ink)] bg-[var(--color-paper)] px-3 text-base text-[var(--color-ink)]"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="border-[var(--color-signal-red)] bg-[var(--color-signal-red)] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
                  >
                    Confirm
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Right: Paired hardware table + log */}
        <div className="space-y-4 lg:col-span-5">
          <div className="border border-[var(--color-ink)] bg-[var(--color-paper)] p-4">
            <h3 className="font-display text-2xl font-bold uppercase text-[var(--color-ink)]">
              Paired sensors
            </h3>
            <div className="mt-3 divide-y divide-[var(--color-ink)] border-t border-[var(--color-ink)]">
              <div className="flex items-center justify-between py-2.5 text-base">
                <div>
                  <div className="font-medium text-[var(--color-ink)]">Ray-Ban Meta Glasses</div>
                  <div className="font-serif-italic text-base text-[var(--color-ink)]/75">
                    Optical HUD presence
                  </div>
                </div>
                <StatusBadge kind="allow" tone="vivid" label="Verified" />
              </div>
              <div className="flex items-center justify-between py-2.5 text-base">
                <div>
                  <div className="font-medium text-[var(--color-ink)]">Trusted Phone</div>
                  <div className="font-serif-italic text-base text-[var(--color-ink)]/75">
                    Step-up confirmation
                  </div>
                </div>
                <StatusBadge kind="allow" tone="vivid" label="Active" />
              </div>
            </div>
          </div>

          <div className="border border-[var(--color-ink)] bg-[var(--color-paper)] p-4">
            <h3 className="font-display text-2xl font-bold uppercase text-[var(--color-ink)]">
              Recent checks (Demo)
            </h3>
            <ul className="mt-3 divide-y divide-[var(--color-ink)] border-t border-[var(--color-ink)]">
              {activityFeed.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 py-2.5 text-base"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--color-ink)]">{item.label}</div>
                    <div className="font-mono text-base text-[var(--color-ink)]/75">{item.time}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-mono text-base font-semibold tabular-nums text-[var(--color-ink)]">
                      {item.amount}
                    </span>
                    <StatusBadge kind={item.kind} tone="vivid" label={item.decisionLabel} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  if (prefersReduced) {
    return (
      <section
        ref={sectionRef}
        id="overview"
        aria-label="Sentinel wearable optical portal"
        data-reduced-motion="true"
        className="relative w-full scroll-mt-20 bg-[var(--color-ink)] text-[var(--color-paper)]"
      >
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="font-mono text-base font-semibold uppercase tracking-wider text-[var(--color-signal-red)]">
                00 Observation · Wearable Auth
              </p>
              <h1 className="mt-3 font-display text-6xl font-black uppercase text-[var(--color-paper)] sm:text-7xl">
                <RollingText text="Trust the person." highlightWordIndex={2} />
              </h1>
              <p className="mt-3 font-serif-italic text-2xl text-[var(--color-paper)]/90">
                Voice verification grounded in{' '}
                <span className="underline decoration-[var(--color-signal-red)] decoration-2 underline-offset-4">
                  live optical proximity
                </span>
                .
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  onClick={onGetStarted}
                  className="border-[var(--color-signal-red)] bg-[var(--color-signal-red)] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
                >
                  Get started
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onSignIn}
                  className="border-[var(--color-paper)] bg-transparent text-[var(--color-paper)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
                >
                  {isSignedIn ? 'Open portal' : 'Sign in'}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col items-center">
              <img
                src={HERO_GLASSES_SRC}
                alt="Ray-Ban Meta smart glasses secured by Sentinel"
                className="max-h-72 w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.8)]"
              />
            </div>
          </div>

          <div className="mt-10">{renderLiveInterface()}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="overview"
      aria-label="Sentinel wearable optical portal"
      data-reduced-motion="false"
      className="relative min-h-[210vh] w-full scroll-mt-20 bg-[var(--color-ink)] text-[var(--color-paper)]"
    >
      <div
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          pointerX.set(0);
          pointerY.set(0);
        }}
        className="sticky top-[4rem] flex h-[calc(100vh-4rem)] w-full items-center justify-center overflow-hidden bg-transparent text-[var(--color-paper)]"
        style={{ perspective: 1200 }}
      >
        {/* Technical axis crosshairs revealed as scroll enters the lens */}
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 1200 700"
          style={{ opacity: axisOpacity }}
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          <motion.line
            x1="0"
            y1="350"
            x2="1200"
            y2="350"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            style={{ pathLength: reticlePathLength }}
          />
          <motion.line
            x1="600"
            y1="0"
            x2="600"
            y2="700"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            style={{ pathLength: reticlePathLength }}
          />
        </motion.svg>

        {/* DIMENSIONAL WARP TUNNEL: concentric perspective rings + depth vectors triggered on scroll or button entry */}
        <motion.div
          aria-hidden="true"
          data-testid="dimension-warp-tunnel"
          style={{
            opacity: isWarping ? undefined : tunnelOpacity,
            scale: isWarping ? undefined : tunnelScale,
            rotate: isWarping ? undefined : tunnelRotate,
          }}
          key={warpPulseKey}
          initial={isWarping ? { opacity: 0.95, scale: 0.2, rotate: -12 } : false}
          animate={isWarping ? { opacity: [0.95, 1, 0], scale: [0.2, 2.2, 4.8], rotate: [-12, 18, 42] } : undefined}
          transition={isWarping ? { duration: 0.78, ease: [0.16, 1, 0.3, 1] } : undefined}
          className="pointer-events-none absolute inset-0 z-15 flex items-center justify-center"
        >
          <svg viewBox="0 0 800 800" className="h-[115vmin] w-[115vmin] overflow-visible">
            {[
              { r: 58, stroke: 'var(--color-signal-red)', dash: 'none', width: 2.2 },
              { r: 108, stroke: 'var(--color-indigo)', dash: '8 6', width: 2 },
              { r: 168, stroke: 'var(--color-paper)', dash: 'none', width: 1.4 },
              { r: 238, stroke: 'var(--color-indigo)', dash: '14 8', width: 1.8 },
              { r: 312, stroke: 'var(--color-signal-red)', dash: '6 10', width: 1.5 },
              { r: 386, stroke: 'var(--color-paper)', dash: 'none', width: 1.2 },
            ].map((ring, idx) => (
              <circle
                key={idx}
                cx="400"
                cy="400"
                r={ring.r}
                fill="none"
                stroke={ring.stroke}
                strokeWidth={ring.width}
                strokeDasharray={ring.dash === 'none' ? undefined : ring.dash}
                strokeOpacity={0.85}
              />
            ))}
            {/* Radial dimensional depth vectors converging to lens center */}
            {Array.from({ length: 16 }).map((_, idx) => {
              const angle = (idx * Math.PI * 2) / 16;
              const x1 = 400 + Math.cos(angle) * 72;
              const y1 = 400 + Math.sin(angle) * 72;
              const x2 = 400 + Math.cos(angle) * 410;
              const y2 = 400 + Math.sin(angle) * 410;
              return (
                <line
                  key={idx}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={idx % 2 === 0 ? 'var(--color-indigo)' : 'var(--color-paper)'}
                  strokeOpacity={0.55}
                  strokeWidth={idx % 4 === 0 ? 1.8 : 1}
                />
              );
            })}
          </svg>
        </motion.div>

        {/* Crisp optical aperture crossing ring at threshold */}
        <motion.div
          aria-hidden="true"
          style={{ opacity: isWarping ? undefined : apertureFlashOpacity }}
          animate={isWarping ? { opacity: [0, 0.65, 0] } : undefined}
          transition={isWarping ? { duration: 0.65, ease: 'easeInOut' } : undefined}
          className="pointer-events-none absolute inset-0 z-15 border-[12px] border-[var(--color-indigo)]/70 bg-[var(--color-indigo)]/15"
        />

        {/* STAGE 1: Backgroundless 3D rotating smart glasses + condensed typography on Ink */}
        <motion.div
          style={{
            opacity: glassesOpacity,
            pointerEvents: isPortalInteractive ? 'none' : 'auto',
          }}
          className="relative z-10 h-full w-full"
        >
          <motion.div
            animate={{
              opacity: manualPortalOpen ? 0 : 1,
              scale: manualPortalOpen ? 3.6 : 1,
            }}
            transition={{ duration: 0.54, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: '47.4% 52.4%' }}
            className="mx-auto flex h-full w-full max-w-6xl flex-col items-center justify-between px-4 py-6 sm:px-6 lg:px-8"
          >
            <motion.div
              style={{ opacity: heroCopyOpacity, y: heroCopyY }}
              className="flex max-w-3xl flex-col items-center text-center"
            >
              <p className="font-mono text-base font-semibold uppercase tracking-widest text-[var(--color-signal-red)]">
                00 Observation · Adaptive Voice Firewall
              </p>
              <h1 className="mt-2 font-display text-6xl font-black uppercase text-[var(--color-paper)] sm:text-7xl lg:text-8xl">
                <RollingText text="Trust the person." highlightWordIndex={2} />
              </h1>
            </motion.div>

          {/* Dynamic 3D rotating transparent Ray-Ban smart glasses + zoom dive into right lens (47.4% 52.4%) */}
          <motion.div
            style={{
              rotateX: tiltX,
              rotateY: tiltY,
              transformPerspective: 1200,
              transformStyle: 'preserve-3d',
              scale: glassesScale,
              y: glassesY,
              transformOrigin: '47.4% 52.4%',
            }}
            className="relative mx-auto flex items-center justify-center"
          >
            {/* Rotating orbital calibration arcs floating behind backgroundless glasses */}
            <motion.svg
              aria-hidden="true"
              viewBox="0 0 520 260"
              animate={{ rotateZ: [0, 360] }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
              className="pointer-events-none absolute h-[145%] w-[115%] opacity-55"
            >
              <circle
                cx="260"
                cy="130"
                r="118"
                fill="none"
                stroke="var(--color-indigo)"
                strokeWidth="1.2"
                strokeDasharray="10 8"
              />
              <circle
                cx="260"
                cy="130"
                r="92"
                fill="none"
                stroke="var(--color-paper)"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeDasharray="3 9"
              />
            </motion.svg>

            {/* Continuous dynamic 3D rotation showcase */}
            <motion.div
              animate={{
                rotateY: [-14, 14, -14],
                rotateX: [4, -4, 4],
                rotateZ: [-1.4, 1.4, -1.4],
                y: [-7, 7, -7],
              }}
              transition={{
                duration: 8.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ transformStyle: 'preserve-3d' }}
              className="relative"
            >
              <img
                src={HERO_GLASSES_SRC}
                alt="Ray-Ban Meta smart glasses secured by Sentinel"
                className="block max-h-[34vh] w-auto max-w-full select-none object-contain drop-shadow-[0_26px_42px_rgba(0,0,0,0.85)] sm:max-h-[42vh]"
                draggable={false}
              />

              {/* Rotating Optical Target Reticle locked on front right lens (47.4% 52.4%) */}
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 120 120"
                style={{
                  opacity: reticleOpacity,
                  left: '47.4%',
                  top: '52.4%',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 sm:h-24 sm:w-24"
              >
                <motion.circle
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke="var(--color-paper)"
                  strokeOpacity="0.85"
                  strokeWidth="1.5"
                  strokeDasharray="6 5"
                  style={{ pathLength: reticlePathLength }}
                />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="24"
                  fill="none"
                  stroke="var(--color-signal-red)"
                  strokeWidth="2"
                  style={{ pathLength: reticlePathLength }}
                />
                <circle cx="60" cy="60" r="3.2" fill="var(--color-signal-red)" />
              </motion.svg>
            </motion.div>
          </motion.div>

          <motion.div
            style={{ opacity: heroCopyOpacity }}
            className="flex flex-col items-center gap-2 pb-1"
          >
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                size="md"
                onClick={onGetStarted}
                className="border-[var(--color-signal-red)] bg-[var(--color-signal-red)] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
              >
                Get started
              </Button>
              <Button
                size="md"
                variant="outline"
                onClick={onSignIn}
                className="border-[var(--color-paper)] bg-transparent text-[var(--color-paper)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
              >
                {isSignedIn ? 'Open portal' : 'Sign in'}
              </Button>
              <Button
                size="md"
                variant="outline"
                onClick={handleEnterLensPortal}
                className="border-[var(--color-paper)] bg-transparent text-[var(--color-paper)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
              >
                <span>Enter lens interface</span>
                <ArrowRight className="h-4 w-4 text-[var(--color-signal-red)]" />
              </Button>
            </div>
          </motion.div>
          </motion.div>
        </motion.div>

        {/* STAGE 2: Dimensional Sentinel Portal rushing forward out of Z-space inside the glasses */}
        <motion.div
          initial={false}
          animate={
            manualPortalOpen
              ? { opacity: 1, scale: 1, y: 0, rotateX: 0 }
              : undefined
          }
          transition={
            manualPortalOpen
              ? { duration: 0.68, ease: [0.16, 1, 0.3, 1] }
              : undefined
          }
          style={
            manualPortalOpen
              ? { transformPerspective: 1200, pointerEvents: 'auto' }
              : {
                  opacity: portalOpacity,
                  scale: portalScale,
                  y: portalY,
                  rotateX: portalRotateX,
                  transformPerspective: 1200,
                  pointerEvents: isPortalInteractive ? 'auto' : 'none',
                }
          }
          aria-hidden={!isPortalInteractive}
          className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto px-4 py-4 sm:items-center sm:px-6 lg:px-8"
        >
          {renderLiveInterface()}
        </motion.div>
      </div>
    </section>
  );
}
