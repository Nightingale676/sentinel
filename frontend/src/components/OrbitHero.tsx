import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';
import { Pause, Play } from 'lucide-react';
import { computeOrbitNodePose } from '@/src/lib/sentinel-logic';
import {
  AimIllustrationArtwork,
  LivePhoneDashboardReplica,
  SentinelShieldCoreSVG,
  SmartGlassesArtwork,
} from './OrbitIllustrations';
import { Button } from './ui/button';
import { ScrollZoomSection } from './ScrollZoomSection';

export interface OrbitNodeMeta {
  id: 'glasses' | 'phone' | 'aim';
  title: string;
  ariaLabel: string;
  tooltip: string;
  detailLine1: string;
  detailLine2: string;
  targetSectionId: string;
}

export const ORBIT_NODES: OrbitNodeMeta[] = [
  {
    id: 'glasses',
    title: 'Smart glasses protection',
    ariaLabel: 'Smart glasses verifying voice — press Enter for details',
    tooltip: 'Confirms hands-free wearable requests inside your field of view.',
    detailLine1:
      'Wearable hardware presence and vocal cadence are checked together before any account command executes.',
    detailLine2:
      'Synthetic playback without physical proximity is blocked automatically.',
    targetSectionId: 'protects',
  },
  {
    id: 'phone',
    title: 'Live mobile dashboard',
    ariaLabel: 'Smartphone running Sentinel customer dashboard — press Enter for details',
    tooltip: 'Displays explicit Allow, Step up, or Block states on every check.',
    detailLine1:
      'Your portal reports verification decisions in plain language alongside timestamped audit notes.',
    detailLine2:
      'Unfamiliar amounts pause cleanly for your personal passphrase confirmation.',
    targetSectionId: 'simulator',
  },
  {
    id: 'aim',
    title: 'Genuine voice, safe request',
    ariaLabel: 'Illustration showing real voice verified and deepfake blocked — press Enter for details',
    tooltip: 'Natural owner voice proceeds smoothly while cloned audio is deflected.',
    detailLine1:
      'Sentinel evaluates vocal authenticity, trusted hardware context, and action severity concurrently.',
    detailLine2:
      'Impersonation attempts stop at the firewall prior to transfer or credential changes.',
    targetSectionId: 'how-it-works',
  },
];

interface OrbitHeroProps {
  onLearnMoreSection?: (sectionId: string) => void;
  onBecomeActive?: (bandBackground: string) => void;
}

export function OrbitHero({ onLearnMoreSection, onBecomeActive }: OrbitHeroProps) {
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

  const [isPaused, setIsPaused] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [baseRotation, setBaseRotation] = useState(0);
  const [radiusPx, setRadiusPx] = useState(215);

  const tiltXRaw = useMotionValue(0);
  const tiltYRaw = useMotionValue(0);
  const tiltX = useSpring(tiltXRaw, { stiffness: 110, damping: 20 });
  const tiltY = useSpring(tiltYRaw, { stiffness: 110, damping: 20 });

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartRotRef = useRef(0);
  const velocityRef = useRef(0);
  const lastXRef = useRef(0);
  const targetRotationRef = useRef<number | null>(null);

  useEffect(() => {
    const updateRadius = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const basis = Math.min(vw, vh);
      if (vw < 640) {
        setRadiusPx(Math.max(88, Math.min(108, Math.round(vw * 0.24))));
      } else if (vw < 1024) {
        setRadiusPx(Math.max(170, Math.min(205, Math.round(basis * 0.25))));
      } else {
        setRadiusPx(Math.max(200, Math.min(235, Math.round(basis * 0.26))));
      }
    };
    updateRadius();
    window.addEventListener('resize', updateRadius);
    return () => window.removeEventListener('resize', updateRadius);
  }, []);

  useEffect(() => {
    if (prefersReduced) return;
    let rafId = 0;
    let lastTs = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      if (targetRotationRef.current !== null) {
        setBaseRotation((prev) => {
          const target = targetRotationRef.current!;
          const diff = target - prev;
          if (Math.abs(diff) < 0.3) {
            targetRotationRef.current = null;
            return target;
          }
          return prev + diff * Math.min(1, dt * 8);
        });
      } else if (!isDraggingRef.current) {
        if (Math.abs(velocityRef.current) > 0.4) {
          setBaseRotation((prev) => prev + velocityRef.current * dt);
          velocityRef.current *= Math.pow(0.06, dt);
        } else if (!isPaused && hoveredIndex === null) {
          setBaseRotation((prev) => (prev + 12 * dt) % 360);
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [prefersReduced, isPaused, hoveredIndex]);

  const bringNodeToFront = (index: number) => {
    setSelectedIndex(index);
    if (prefersReduced) return;
    const stepDeg = 360 / ORBIT_NODES.length;
    const currentAngle = (baseRotation + index * stepDeg) % 360;
    let delta = 90 - currentAngle;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    targetRotationRef.current = baseRotation + delta;
  };

  const handleLearnMore = (sectionId: string) => {
    if (onLearnMoreSection) {
      onLearnMoreSection(sectionId);
      return;
    }
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  const handlePointerMoveStage = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartXRef.current;
      velocityRef.current = (e.clientX - lastXRef.current) * 6;
      lastXRef.current = e.clientX;
      setBaseRotation(dragStartRotRef.current + dx * 0.45);
      return;
    }
    if (prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width - 0.5;
    const normY = (e.clientY - rect.top) / rect.height - 0.5;
    tiltYRaw.set(normX * 5);
    tiltXRaw.set(-normY * 4);
  };

  const handlePointerDownStage = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    isDraggingRef.current = true;
    targetRotationRef.current = null;
    dragStartXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    dragStartRotRef.current = baseRotation;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUpStage = () => {
    isDraggingRef.current = false;
  };

  const selectedNode = selectedIndex !== null ? ORBIT_NODES[selectedIndex] : null;
  const stageHeight = Math.max(330, Math.round(radiusPx * 1.5 + 150));

  const cardBgClass = (id: OrbitNodeMeta['id']) =>
    id === 'aim' ? 'bg-[var(--color-blush)]' : 'bg-[var(--color-paper)]';

  return (
    <ScrollZoomSection
      ariaLabel="Sentinel adaptive firewall architecture"
      bandBackground="var(--color-ink)"
      bandText="var(--color-paper)"
      onBecomeActive={onBecomeActive}
      className="overflow-x-clip border-[var(--color-paper)]/20"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex w-full flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-base font-semibold uppercase tracking-wider text-[var(--color-signal-red)]">
              02 Architecture
            </p>
            <h2 className="mt-2 font-display text-4xl font-black uppercase text-[var(--color-paper)] sm:text-6xl">
              Spoken verification loop
            </h2>
            <p className="mt-2 font-serif-italic text-xl text-[var(--color-paper)]/85">
              Wearable presence,{' '}
              <span className="underline decoration-[var(--color-signal-red)] decoration-2 underline-offset-4">
                account surface
              </span>
              , and deflection shield rotating around one evaluator.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPaused((prev) => !prev)}
            aria-pressed={isPaused}
            className="border-[var(--color-paper)] bg-transparent text-[var(--color-paper)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
          >
            {isPaused || prefersReduced ? (
              <>
                <Play className="h-4 w-4" />
                <span>{prefersReduced ? 'Reduced motion active' : 'Resume orbit'}</span>
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                <span>Pause orbit</span>
              </>
            )}
          </Button>
        </div>

        <div
          className="relative mt-8 w-full"
          data-reduced-motion={prefersReduced ? 'true' : 'false'}
        >
          {prefersReduced ? (
            <div
              role="group"
              aria-label="Sentinel voice protection core"
              className="flex flex-col items-center gap-6 py-4"
            >
              <div className="border border-[var(--color-ink)] bg-[var(--color-paper)] p-5">
                <SentinelShieldCoreSVG />
              </div>
              <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
                {ORBIT_NODES.map((node, idx) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => bringNodeToFront(idx)}
                    aria-label={node.ariaLabel}
                    aria-pressed={selectedIndex === idx}
                    className={`flex flex-col items-center justify-center border border-[var(--color-ink)] ${cardBgClass(
                      node.id
                    )} p-5 text-center transition-colors hover:border-[var(--color-indigo)] cursor-pointer`}
                  >
                    {node.id === 'glasses' && <SmartGlassesArtwork />}
                    {node.id === 'phone' && <LivePhoneDashboardReplica />}
                    {node.id === 'aim' && <AimIllustrationArtwork />}
                    <span className="mt-3 font-mono text-base font-medium text-[var(--color-ink)]">
                      {node.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <motion.div
              role="group"
              aria-label="Sentinel interactive protection orbit"
              onPointerMove={handlePointerMoveStage}
              onPointerDown={handlePointerDownStage}
              onPointerUp={handlePointerUpStage}
              onPointerCancel={handlePointerUpStage}
              onPointerLeave={() => {
                tiltXRaw.set(0);
                tiltYRaw.set(0);
                isDraggingRef.current = false;
              }}
              style={{
                height: stageHeight,
                rotateX: tiltX,
                rotateY: tiltY,
                transformPerspective: 1000,
                touchAction: 'pan-y',
              }}
              className="relative mx-auto flex w-full items-center justify-center select-none cursor-grab active:cursor-grabbing"
            >
              {/* Hairline orbit ring */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full border border-[var(--color-paper)]/45"
                style={{
                  width: radiusPx * 2,
                  height: Math.round(radiusPx * 1.42),
                }}
              />

              {/* Central Core */}
              <div className="relative z-20 flex items-center justify-center">
                <motion.div
                  aria-hidden="true"
                  animate={
                    isPaused
                      ? { scale: 1, opacity: 0.45 }
                      : { scale: [1, 1.12, 1], opacity: [0.45, 0.2, 0.45] }
                  }
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute h-36 w-36 rounded-full border border-[var(--color-paper)]/40"
                />
                <SentinelShieldCoreSVG />
              </div>

              {ORBIT_NODES.map((node, idx) => {
                const pose = computeOrbitNodePose(idx, ORBIT_NODES.length, baseRotation, radiusPx);
                const isHovered = hoveredIndex === idx;
                const isSelected = selectedIndex === idx;

                return (
                  <motion.div
                    key={node.id}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      zIndex: isHovered || isSelected ? 45 : pose.zIndex,
                      transform: `translate3d(calc(-50% + ${pose.x}px), calc(-50% + ${pose.y}px), 0) scale(${
                        isHovered ? Math.max(1.06, pose.scale * 1.04) : pose.scale
                      })`,
                      opacity: isHovered || isSelected ? 1 : pose.opacity,
                    }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex((curr) => (curr === idx ? null : curr))}
                      onFocus={() => setHoveredIndex(idx)}
                      onBlur={() => setHoveredIndex((curr) => (curr === idx ? null : curr))}
                      onClick={() => bringNodeToFront(idx)}
                      aria-label={node.ariaLabel}
                      aria-pressed={isSelected}
                      className={`group relative flex flex-col items-center justify-center border ${cardBgClass(
                        node.id
                      )} p-3.5 transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[var(--color-signal-red)] ring-2 ring-[var(--color-signal-red)]'
                          : 'border-[var(--color-ink)] hover:border-[var(--color-indigo)]'
                      }`}
                    >
                      {node.id === 'glasses' && <SmartGlassesArtwork />}
                      {node.id === 'phone' && <LivePhoneDashboardReplica />}
                      {node.id === 'aim' && <AimIllustrationArtwork />}

                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 3 }}
                            transition={{ duration: 0.14 }}
                            role="tooltip"
                            className="pointer-events-none absolute -bottom-16 left-1/2 z-50 w-72 -translate-x-1/2 border border-[var(--color-ink)] bg-[var(--color-paper)] px-3.5 py-2 text-center font-sans text-base text-[var(--color-ink)]"
                          >
                            {node.tooltip}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {selectedNode && (
              <motion.div
                key={selectedNode.id}
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReduced ? undefined : { opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                className="mx-auto mt-6 max-w-2xl border border-[var(--color-ink)] bg-[var(--color-paper)] p-6 text-[var(--color-ink)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-display text-2xl font-bold uppercase text-[var(--color-ink)]">
                      {selectedNode.title}
                    </h3>
                    <p className="mt-1.5 text-base leading-relaxed text-[var(--color-ink)]/85">
                      {selectedNode.detailLine1} {selectedNode.detailLine2}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLearnMore(selectedNode.targetSectionId)}
                      className="border-[var(--color-ink)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-indigo)] hover:border-[var(--color-indigo)] hover:text-[var(--color-paper)]"
                    >
                      Learn more
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedIndex(null)}
                      aria-label="Close detail panel"
                      className="text-[var(--color-ink)] hover:bg-[var(--color-blush)]"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-4 font-mono text-base text-[var(--color-paper)]/80">
            Fig. 2 — Orbital model showing 120° coupling across wearable telemetry, mobile interface, and waveform screening. Drag horizontally or select any node to inspect.
          </p>
        </div>
      </div>
    </ScrollZoomSection>
  );
}
