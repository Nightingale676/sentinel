import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { StatusBadge, type StatusKind } from './ui/StatusBadge';

/**
 * Sentinel Shield Core: architectural ink line art on paper fill with signal red peak bar.
 */
export function SentinelShieldCoreSVG() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-24 w-24 sm:h-28 sm:w-28 text-[var(--color-ink)]"
      aria-hidden="true"
    >
      <path
        d="M60 10 L100 26 V56 C100 82 82 101 60 110 C38 101 20 82 20 56 V26 Z"
        fill="var(--color-paper)"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M60 19 L91 31 V55 C91 76 77 92 60 100 C43 92 29 76 29 55 V31 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="square">
        <line x1="42" y1="54" x2="42" y2="66" />
        <line x1="51" y1="45" x2="51" y2="75" />
        <line x1="60" y1="36" x2="60" y2="84" stroke="var(--color-signal-red)" strokeWidth="2.8" />
        <line x1="69" y1="46" x2="69" y2="74" />
        <line x1="78" y1="54" x2="78" y2="66" />
      </g>
    </svg>
  );
}

/**
 * Smart Glasses: ink line art on paper with diagonal signal red lens glint & optical sensor mark.
 */
export function SmartGlassesArtwork() {
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 210 92"
        className="w-36 sm:w-44 h-auto text-[var(--color-ink)]"
        role="img"
        aria-label="Ink line drawing of smart glasses verifying voice"
      >
        {/* Left & right temple arms */}
        <path d="M22 30 L8 42 L14 48" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M188 30 L202 42 L196 48" fill="none" stroke="currentColor" strokeWidth="1.6" />
        {/* Outer frame */}
        <path
          d="M22 24 H84 L96 36 H114 L126 24 H188 V54 C188 68 176 76 160 76 H134 C122 76 116 64 114 52 H96 C94 64 88 76 76 76 H50 C34 76 22 68 22 54 Z"
          fill="var(--color-paper)"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="miter"
        />
        {/* Left lens inner aperture */}
        <rect
          x="32"
          y="33"
          width="50"
          height="33"
          fill="var(--color-paper)"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {/* Right lens inner aperture */}
        <rect
          x="128"
          y="33"
          width="50"
          height="33"
          fill="var(--color-paper)"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {/* Red lens glint across lenses */}
        <g stroke="var(--color-signal-red)" strokeWidth="2.2" strokeLinecap="square">
          <line x1="36" y1="60" x2="48" y2="38" />
          <line x1="43" y1="62" x2="51" y2="47" />
          <line x1="133" y1="60" x2="145" y2="38" />
          <line x1="140" y1="62" x2="148" y2="47" />
        </g>
        {/* Minimal acoustic bars inside left lens */}
        <g stroke="currentColor" strokeWidth="1.5">
          <line x1="56" y1="47" x2="56" y2="53" />
          <line x1="63" y1="43" x2="63" y2="57" />
          <line x1="70" y1="45" x2="70" y2="55" />
          <line x1="77" y1="48" x2="77" y2="52" />
        </g>
        {/* HUD check inside right lens */}
        <path
          d="M150 50 L156 56 L168 43"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        {/* Signal red camera indicator */}
        <circle cx="180" cy="30" r="3" fill="var(--color-signal-red)" />
      </svg>
      <span className="mt-1 font-mono text-base font-medium text-[var(--color-ink)]">
        Wearable HUD
      </span>
    </div>
  );
}

const PHONE_STATES: Array<{
  label: string;
  kind: StatusKind;
}> = [
  { label: 'Allow', kind: 'allow' },
  { label: 'Step up', kind: 'step_up' },
  { label: 'Block', kind: 'block' },
];

/**
 * Live Phone Dashboard Replica: Paper bezel with Electric Indigo screen & paper text.
 */
export function LivePhoneDashboardReplica() {
  const prefersReduced = useReducedMotion();
  const [stateIdx, setStateIdx] = useState(0);

  useEffect(() => {
    if (prefersReduced) return;
    const timer = window.setInterval(() => {
      setStateIdx((prev) => (prev + 1) % PHONE_STATES.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [prefersReduced]);

  const activeState = PHONE_STATES[stateIdx];

  return (
    <div
      className="mx-auto w-[156px] sm:w-[176px] border border-[var(--color-ink)] bg-[var(--color-paper)] p-2 text-[var(--color-ink)]"
      aria-label="Live preview of Sentinel mobile dashboard"
    >
      <div className="mx-auto mb-1.5 h-[2px] w-10 bg-[var(--color-ink)]" />
      {/* Electric Indigo Phone Screen with Paper text (5.49:1) */}
      <div className="border border-[var(--color-ink)] bg-[var(--color-indigo)] p-2.5 text-[var(--color-paper)]">
        <div className="flex items-center justify-between border-b border-[var(--color-paper)]/30 pb-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">
            Sentinel
          </span>
          <span className="h-2 w-2 bg-[var(--color-signal-red)]" aria-hidden="true" />
        </div>
        <div className="mt-2 border border-[var(--color-paper)]/35 bg-[var(--color-ink)]/25 p-2">
          <div className="font-mono text-[9px] uppercase text-[var(--color-paper)]/85">
            Checking · 4829
          </div>
          <div className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums text-[var(--color-paper)]">
            $14,825.40
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center">
          <StatusBadge kind={activeState.kind} tone="vivid" label={activeState.label} compact />
        </div>
        <div className="mt-2 flex items-center justify-center">
          <div className="flex h-7 w-7 items-center justify-center border border-[var(--color-paper)]/60 bg-[var(--color-paper)] text-[var(--color-ink)]">
            <Mic className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Aim Illustration: Blush card surface with ink deflection diagram & signal red deflection mark.
 */
export function AimIllustrationArtwork() {
  return (
    <div className="flex flex-col items-center bg-[var(--color-blush)] px-2 py-1 text-[var(--color-ink)]">
      <svg
        viewBox="0 0 220 110"
        className="w-40 sm:w-48 h-auto text-[var(--color-ink)]"
        role="img"
        aria-label="Illustration showing genuine voice verified through shield to bank while deepfake bounces off"
      >
        {/* Genuine waveform + arrow through shield */}
        <g stroke="currentColor" strokeWidth="1.6" fill="none">
          <line x1="16" y1="32" x2="16" y2="42" />
          <line x1="23" y1="26" x2="23" y2="48" />
          <line x1="30" y1="22" x2="30" y2="52" />
          <line x1="37" y1="28" x2="37" y2="46" />
          <path d="M44 37 L90 37" />
          <path d="M126 37 L166 37" />
          <path d="M161 32 L167 37 L161 42" />
        </g>

        {/* Synthetic/deepfake trace deflected by shield */}
        <g stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" fill="none">
          <line x1="18" y1="78" x2="18" y2="86" />
          <line x1="25" y1="74" x2="25" y2="90" />
          <line x1="32" y1="77" x2="32" y2="87" />
          <path d="M40 82 L84 62 L58 94" />
        </g>

        {/* Signal red mark: deepfake deflection cross */}
        <g stroke="var(--color-signal-red)" strokeWidth="2.4" strokeLinecap="square">
          <line x1="68" y1="77" x2="78" y2="87" />
          <line x1="78" y1="77" x2="68" y2="87" />
        </g>

        <text
          x="34"
          y="105"
          textAnchor="middle"
          fill="#141414"
          fontSize="8.5"
          fontWeight="700"
          fontFamily="IBM Plex Mono, monospace"
        >
          CLONE
        </text>

        {/* Ink & paper Shield */}
        <path
          d="M108 18 L127 25 V44 C127 57 118 67 108 72 C98 67 89 57 89 44 V25 Z"
          fill="var(--color-paper)"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M100 44 L106 50 L117 37"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />

        {/* Bank / Account icon in ink line art */}
        <g transform="translate(172, 19)">
          <rect
            x="0"
            y="0"
            width="36"
            height="36"
            fill="var(--color-paper)"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M8 15 L18 9 L28 15 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <rect x="10" y="17" width="3" height="9" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <rect x="16.5" y="17" width="3" height="9" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <rect x="23" y="17" width="3" height="9" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <line x1="8" y1="28" x2="28" y2="28" stroke="currentColor" strokeWidth="1.6" />
        </g>
      </svg>
      <span className="mt-1 font-mono text-base font-medium text-[var(--color-ink)]">
        Genuine voice. Safe request.
      </span>
    </div>
  );
}
