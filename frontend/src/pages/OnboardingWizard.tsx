import { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { AudioAnalysisPanel } from '@/src/components/AudioAnalysisPanel';
import { apiClient, type CustomerUser } from '@/src/lib/api-client';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { StatusBadge } from '@/src/components/ui/StatusBadge';

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
  const [voiceEnrolled, setVoiceEnrolled] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
            {step === 2 && 'Enroll your owner voice'}
            {step === 3 && 'Personal passphrase'}
            {step === 4 && 'Mobile number check'}
            {step === 5 && 'Review and activate'}
          </CardTitle>
          <CardDescription className="font-serif-italic text-lg">
            {step === 1 && 'Review how your voice profile is used before enrolling.'}
            {step === 2 && 'Record 25–30 seconds of your own voice and submit it once. Later sign-ins verify against this same profile.'}
            {step === 3 && 'Set your demo account passphrase. It cannot replace voice verification or authorize a payment.'}
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
                Enrollment sends your recording to DetectifAI to create a voice profile for future verification. Live checks use provider credits. With your registry consent, Aarohan Bank India can see your account name, customer reference, and enrollment and verification dates. Separate recording-retention consent lets organization admins play recordings during security review, including blocked attempts. Voice replacement and provider-profile deletion are not supported in this interface.
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
              <AudioAnalysisPanel onOwnerEnrolled={() => setVoiceEnrolled(true)} />
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button disabled={!voiceEnrolled} onClick={() => { setError(null); setStep(3); }}>Continue</Button>
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
                  <StatusBadge kind={voiceEnrolled ? 'allow' : 'step_up'} label={voiceEnrolled ? 'Owner voice enrolled' : 'Enrollment required'} />
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
