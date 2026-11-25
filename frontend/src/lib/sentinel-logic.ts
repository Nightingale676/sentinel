export type FirewallDecision = 'allow' | 'step_up' | 'block';

export interface OrbitNodePose {
  index: number;
  angleDeg: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  blurPx: number;
  zIndex: number;
  isFront: boolean;
}

/**
 * Computes 2D orbital coordinates and pseudo-3D depth attributes for an item
 * evenly spaced around a circular path.
 * 90 deg is at the bottom-front (closest to viewer); 270 deg is at the top-back.
 */
export function computeOrbitNodePose(
  index: number,
  totalNodes: number,
  baseRotationDeg: number,
  radiusPx: number
): OrbitNodePose {
  const safeTotal = Math.max(1, totalNodes);
  const offsetDeg = (360 / safeTotal) * index;
  const rawAngle = (baseRotationDeg + offsetDeg) % 360;
  const angleDeg = rawAngle < 0 ? rawAngle + 360 : rawAngle;
  const rad = (angleDeg * Math.PI) / 180;

  // Horizontal radius matches full circle; slight vertical compression adds perspective
  const x = Math.cos(rad) * radiusPx;
  const y = Math.sin(rad) * radiusPx * 0.72;

  // depthFactor: +1 at bottom-front (90 deg), -1 at top-back (270 deg)
  const depthFactor = Math.sin(rad);
  const normalizedDepth = (depthFactor + 1) / 2; // 0 (back) .. 1 (front)

  const scale = Number((0.78 + normalizedDepth * 0.3).toFixed(3)); // 0.78 .. 1.08
  const opacity = Number((0.55 + normalizedDepth * 0.45).toFixed(3)); // 0.55 .. 1.0
  const blurPx = Number(((1 - normalizedDepth) * 1.4).toFixed(2)); // 1.4px back .. 0px front
  const zIndex = Math.round(10 + normalizedDepth * 30);
  const isFront = depthFactor >= 0.15;

  return {
    index,
    angleDeg,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    scale,
    opacity,
    blurPx,
    zIndex,
    isFront,
  };
}

export type SimulatorScenarioId = 'genuine' | 'cloned' | 'risky';

export interface SimulatorLayerResult {
  label: string;
  fillPercent: number;
  tone: 'safe' | 'caution' | 'danger';
  summary: string;
}

export interface SimulatorResult {
  id: SimulatorScenarioId;
  title: string;
  transcript: string;
  decision: FirewallDecision;
  decisionLabel: string;
  headline: string;
  explanation: string;
  layers: SimulatorLayerResult[];
}

export function evaluateSimulatorScenario(scenarioId: SimulatorScenarioId): SimulatorResult {
  switch (scenarioId) {
    case 'genuine':
      return {
        id: 'genuine',
        title: 'Genuine owner',
        transcript: 'Pay my electric bill of $84 from checking.',
        decision: 'allow',
        decisionLabel: 'Approved',
        headline: 'Request completed smoothly',
        explanation:
          'Natural vocal warmth matched your enrolled profile, your usual phone was nearby, and this routine bill fits your normal pattern.',
        layers: [
          {
            label: 'Voice authenticity',
            fillPercent: 96,
            tone: 'safe',
            summary: 'Live vocal resonance matches enrolled owner',
          },
          {
            label: 'Context & device',
            fillPercent: 94,
            tone: 'safe',
            summary: 'Trusted device and familiar location',
          },
          {
            label: 'Action safety',
            fillPercent: 92,
            tone: 'safe',
            summary: 'Routine bill to an existing payee',
          },
        ],
      };
    case 'cloned':
      return {
        id: 'cloned',
        title: 'Cloned voice',
        transcript: 'Urgently wire $4,800 to a new external account right now.',
        decision: 'block',
        decisionLabel: 'Blocked',
        headline: 'Synthetic voice stopped before funds moved',
        explanation:
          'Sentinel noticed subtle speech synthesis patterns and an unfamiliar device, so it blocked the wire immediately and alerted you.',
        layers: [
          {
            label: 'Voice authenticity',
            fillPercent: 18,
            tone: 'danger',
            summary: 'Synthetic cadence detected in voice sample',
          },
          {
            label: 'Context & device',
            fillPercent: 28,
            tone: 'danger',
            summary: 'Unrecognized device outside normal hours',
          },
          {
            label: 'Action safety',
            fillPercent: 22,
            tone: 'danger',
            summary: 'Large urgent transfer to an unverified recipient',
          },
        ],
      };
    case 'risky':
      return {
        id: 'risky',
        title: 'Risky request',
        transcript: 'Send $2,500 to Jordan Lee for the studio deposit.',
        decision: 'step_up',
        decisionLabel: 'Extra verification',
        headline: 'Voice looks real — one quick check needed',
        explanation:
          'Your voice sounds genuine, but sending a large amount to someone new triggers a quick passphrase check to keep your money safe.',
        layers: [
          {
            label: 'Voice authenticity',
            fillPercent: 91,
            tone: 'safe',
            summary: 'Natural speech matches enrolled owner',
          },
          {
            label: 'Context & device',
            fillPercent: 84,
            tone: 'safe',
            summary: 'Trusted phone on home network',
          },
          {
            label: 'Action safety',
            fillPercent: 48,
            tone: 'caution',
            summary: 'Higher-value transfer to a newer payee',
          },
        ],
      };
  }
}

export interface CommandEvaluationInput {
  transcript: string;
  requireStepUpAbove: number;
  strictSyntheticGuard: boolean;
  knownPayeeNames: string[];
}

export interface CommandEvaluationResult {
  decision: FirewallDecision;
  decisionLabel: string;
  message: string;
  amount: number | null;
  recipient: string | null;
  requiresPassphrase: boolean;
}

export function extractAmountFromTranscript(transcript: string): number | null {
  const match = transcript.match(/\$?\s*(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function extractRecipientFromTranscript(transcript: string): string | null {
  const toMatch = transcript.match(/\b(?:to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (toMatch) return toMatch[1].trim();
  const lowercaseTo = transcript.match(/\bto\s+([a-z]{2,20})(?:\s|$)/i);
  if (lowercaseTo) {
    const raw = lowercaseTo[1];
    if (!['check', 'verify', 'save', 'move', 'pay', 'reset', 'new'].includes(raw.toLowerCase())) {
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
  }
  return null;
}

export function evaluateVoiceCommand(input: CommandEvaluationInput): CommandEvaluationResult {
  const text = input.transcript.trim();
  const lower = text.toLowerCase();
  const amount = extractAmountFromTranscript(text);
  const recipient = extractRecipientFromTranscript(text);

  if (!text) {
    return {
      decision: 'block',
      decisionLabel: 'Blocked',
      message: 'Please speak or type a clear request so Sentinel can review it.',
      amount: null,
      recipient: null,
      requiresPassphrase: false,
    };
  }

  // Simulated synthetic / high-risk scam indicators for customer-safe testing
  const scamSignals = [
    'cloned',
    'deepfake',
    'synthetic',
    'bypass',
    'ignore security',
    'disable firewall',
    'urgent wire',
    'gift card',
  ];
  if (scamSignals.some((signal) => lower.includes(signal)) && input.strictSyntheticGuard) {
    return {
      decision: 'block',
      decisionLabel: 'Blocked',
      message:
        'Sentinel paused this request because it sounded unusual or attempted to skip normal safeguards. No money was moved.',
      amount,
      recipient,
      requiresPassphrase: false,
    };
  }

  const highRiskActions = ['password', 'phone number', 'new payee', 'wire', 'export', 'add payee'];
  const isHighRiskAction = highRiskActions.some((kw) => lower.includes(kw));
  const isKnownPayee =
    recipient !== null &&
    input.knownPayeeNames.some((p) => p.toLowerCase() === recipient.toLowerCase());
  const exceedsThreshold = amount !== null && amount >= input.requireStepUpAbove;

  if (isHighRiskAction || exceedsThreshold || (recipient !== null && !isKnownPayee && amount !== null)) {
    return {
      decision: 'step_up',
      decisionLabel: 'Extra verification',
      message:
        exceedsThreshold && amount
          ? `Your voice was verified, and because this transfer is $${amount.toLocaleString()}, please confirm your personal passphrase.`
          : 'Your voice was verified. For your protection, please confirm your personal passphrase before completing this change.',
      amount,
      recipient,
      requiresPassphrase: true,
    };
  }

  return {
    decision: 'allow',
    decisionLabel: 'Approved',
    message:
      amount && recipient
        ? `Voice verified. Sent $${amount.toLocaleString()} to ${recipient}.`
        : 'Voice verified. Your request has been approved.',
    amount,
    recipient,
    requiresPassphrase: false,
  };
}
