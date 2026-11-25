import { useEffect, useRef, useState } from 'react';
import { Check, Mic, MicOff, ShieldCheck } from 'lucide-react';
import { apiClient, type CustomerUser } from '@/src/lib/api-client';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { StatusBadge } from '@/src/components/ui/StatusBadge';

const PHRASES = [
  'My voice protects my everyday banking.',
  'Confirm only requests coming from me.',
  'Pause unusual transfers until I approve.',
];

interface OnboardingWizardProps {
  user: CustomerUser;
  onUserUpdated: (user: CustomerUser) => void;
  onComplete: () => void;
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
}

export function OnboardingWizard({
  user,
  onUserUpdated,
  onComplete,
  onToast,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [recordedCount, setRecordedCount] = useState(user.voiceEnrolledCount);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activePhrase, setActivePhrase] = useState<number | null>(null);
  const [savingSample, setSavingSample] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [audioLevel, setAudioLevel] = useState(14);
  const [passphrase, setPassphrase] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const levelTimerRef = useRef<number | null>(null);
  const captureIdRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (levelTimerRef.current) window.clearInterval(levelTimerRef.current);
      captureIdRef.current += 1;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const recordPhrase = async (phraseIdx: number) => {
    setError(null);
    setIsRecording(true);
    setActivePhrase(phraseIdx);
    setElapsedSeconds(0);
    const captureId = ++captureIdRef.current;

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (captureId !== captureIdRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
      }
    } catch {
      setMicDenied(true);
    }
    if (captureId !== captureIdRef.current) return;

    let ticks = 0;
    const startedAt = Date.now();
    if (levelTimerRef.current) window.clearInterval(levelTimerRef.current);
    levelTimerRef.current = window.setInterval(() => {
      ticks += 1;
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      setAudioLevel(35 + Math.round(Math.abs(Math.sin(ticks * 0.8)) * 55));
    }, 100);

  };

  const stopRecording = async () => {
      if (activePhrase === null || !isRecording) return;
      const phraseIdx = activePhrase;
      captureIdRef.current += 1;
      if (levelTimerRef.current) window.clearInterval(levelTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      setActivePhrase(null);
      setAudioLevel(14);
      setSavingSample(true);

      try {
        const res = await apiClient.submitVoiceSample(phraseIdx);
        setRecordedCount(res.voiceEnrolledCount);
        onToast(`Phrase ${phraseIdx + 1} captured`, 'success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to save voice sample.');
      } finally {
        setSavingSample(false);
      }
  };

  const handleFinish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiClient.completeOnboarding({
        consentAccepted,
        passphrase,
        phoneCode,
      });
      onUserUpdated(res.user);
      onToast('Voice firewall is now active on your account', 'success');
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete setup.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--ink)] pb-4">
        <div>
          <p className="font-mono text-base font-medium uppercase text-[var(--ink-muted)]">
            Step 0{step} of 05 · Enrollment
          </p>
          <h1 className="mt-1 font-display text-4xl font-black uppercase text-[var(--ink)] sm:text-5xl">
            Voice Enrollment
          </h1>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-2.5 w-7 border border-[var(--ink)] transition-colors ${
                n <= step ? 'bg-[var(--ink)]' : 'bg-[var(--bg-paper)]'
              }`}
            />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-[var(--ink)]">
          <CardTitle className="text-3xl font-bold">
            {step === 1 && 'Voice protection consent'}
            {step === 2 && 'Three-phrase enrollment'}
            {step === 3 && 'Personal passphrase'}
            {step === 4 && 'Mobile number check'}
            {step === 5 && 'Review and activate'}
          </CardTitle>
          <CardDescription className="font-serif-italic text-lg">
            {step === 1 && 'Sentinel uses an encrypted vocal signature strictly to protect your account.'}
            {step === 2 && 'Read the phrase and continue speaking naturally. Press Stop when finished. This is demo enrollment; live voice verification is not connected yet.'}
            {step === 3 && 'Used when an unusual or large request triggers step-up verification.'}
            {step === 4 && `Confirm ${user.phone} as your trusted recovery contact.`}
            {step === 5 && 'Inspect your configuration below before activating protection.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          {error && (
            <div
              role="alert"
              className="border border-[var(--accent-red)] bg-[var(--accent-red)] px-4 py-3 font-mono text-base font-medium text-[var(--bg-paper)]"
            >
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-4 text-base leading-relaxed text-[var(--ink)]">
                Your voice signature remains private and is never shared with advertisers or third parties. You may pause or delete your vocal profile at any time from Account settings.
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-1 h-5 w-5 border border-[var(--ink)] accent-[var(--ink)]"
                />
                <span className="text-base text-[var(--ink)]">
                  I agree to enroll my voice signature for Sentinel fraud protection.
                </span>
              </label>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (!consentAccepted) {
                      setError('Please check the consent box before continuing.');
                      return;
                    }
                    setError(null);
                    setStep(2);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {micDenied && (
                <div className="flex items-center gap-2 border border-[var(--ink)] bg-[var(--bg-paper)] px-4 py-3 text-base text-[var(--ink)]">
                  <MicOff className="h-4 w-4 shrink-0 text-[var(--accent-red)]" />
                  <span>Microphone access unavailable. Tap each phrase button to complete a guided capture.</span>
                </div>
              )}

              <div className="border border-[var(--ink)] bg-[var(--bg-paper)] p-4">
                <div className="flex items-center justify-between font-mono text-base text-[var(--ink-muted)]">
                  <span role="status">{isRecording ? `Listening: ${elapsedSeconds} seconds elapsed` : 'Press Record phrase to begin'}</span>
                  <span className="tabular-nums">{recordedCount} / 3 phrases saved</span>
                </div>
                <div className="mt-3 h-3 w-full overflow-hidden border border-[var(--ink)] bg-[var(--bg-paper)]">
                  <div
                    className="h-full bg-[var(--ink)] transition-all duration-100"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {PHRASES.map((phrase, idx) => {
                  const done = recordedCount > idx;
                  return (
                    <div
                      key={phrase}
                      className="flex flex-col gap-3 border border-[var(--ink)] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-mono text-base text-[var(--ink-muted)]">Phrase 0{idx + 1}</p>
                        <p className="mt-0.5 font-serif-italic text-xl text-[var(--ink)]">
                          “{phrase}”
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={done ? 'outline' : 'primary'}
                        disabled={savingSample || (isRecording && activePhrase !== idx)}
                        onClick={() => activePhrase === idx ? stopRecording() : recordPhrase(idx)}
                      >
                        {activePhrase === idx ? 'Stop' : done ? (
                          <>
                            <Check className="h-4 w-4" />
                            Recorded
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4" />
                            {isRecording ? 'Capturing...' : 'Record phrase'}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" disabled={isRecording || savingSample} onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button disabled={isRecording || savingSample}
                  onClick={() => {
                    if (recordedCount < 3) {
                      setError('Please record all 3 short phrases to continue.');
                      return;
                    }
                    setError(null);
                    setStep(3);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="setup-passphrase" className="block font-mono text-base font-medium text-[var(--ink)]">
                  Personal passphrase (3 memorable words)
                </label>
                <Input
                  id="setup-passphrase"
                  type="text"
                  placeholder="e.g. cedar river horizon"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (passphrase.trim().length < 4) {
                      setError('Please enter a passphrase of at least 4 characters.');
                      return;
                    }
                    setError(null);
                    setStep(4);
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--ink)] bg-[var(--bg-paper)] p-4">
                <div>
                  <p className="font-mono text-base text-[var(--ink-muted)]">Trusted mobile number</p>
                  <p className="font-mono text-base font-medium text-[var(--ink)]">{user.phone}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCodeSent(true);
                    setPhoneCode('482910');
                    onToast('Verification code sent (demo code: 482910)', 'info');
                  }}
                >
                  {codeSent ? 'Resend code' : 'Send code'}
                </Button>
              </div>

              <div>
                <label htmlFor="phone-code" className="block font-mono text-base font-medium text-[var(--ink)]">
                  Verification code (Demo: 482910)
                </label>
                <Input
                  id="phone-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 6-digit code"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  className="mt-1.5 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (phoneCode.trim().length < 4) {
                      setError('Please tap "Send code" and enter the verification code.');
                      return;
                    }
                    setError(null);
                    setStep(5);
                  }}
                >
                  Review setup
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="divide-y divide-[var(--ink)] border border-[var(--ink)] bg-[var(--bg-paper)]">
                <div className="flex items-center justify-between px-4 py-3 text-base">
                  <span className="text-[var(--ink-muted)]">Voice profile</span>
                  <StatusBadge kind="allow" label={`${recordedCount} of 3 ready`} />
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-base">
                  <span className="text-[var(--ink-muted)]">Personal passphrase</span>
                  <span className="font-mono font-medium text-[var(--ink)]">Configured</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-base">
                  <span className="text-[var(--ink-muted)]">Mobile recovery</span>
                  <span className="font-mono font-medium text-[var(--ink)]">{user.phone}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(4)}>
                  Back
                </Button>
                <Button onClick={handleFinish} disabled={submitting}>
                  <ShieldCheck className="h-4 w-4" />
                  {submitting ? 'Activating...' : 'Activate Voice Firewall'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
