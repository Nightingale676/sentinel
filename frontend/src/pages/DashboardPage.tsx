import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Mic,
  MicOff,
  Plus,
  Send,
} from 'lucide-react';
import {
  apiClient,
  ApiError,
  type DashboardData,
  type VoiceCommandResponse,
} from '@/src/lib/api-client';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { ModalDialog } from '@/src/components/ui/dialog';
import { Skeleton } from '@/src/components/ui/skeleton';
import { StatusBadge, type StatusKind } from '@/src/components/ui/StatusBadge';
import { AudioAnalysisPanel } from '@/src/components/AudioAnalysisPanel';
import { DictateField } from '@/src/components/DictateField';

interface SpeechRecognitionLike {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface DashboardPageProps {
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  onOfflineDetected: (offline: boolean) => void;
}

function decisionKind(d: 'allow' | 'step_up' | 'block'): { kind: StatusKind; label: string } {
  if (d === 'allow') return { kind: 'allow', label: 'Allow' };
  if (d === 'step_up') return { kind: 'step_up', label: 'Step up' };
  return { kind: 'block', label: 'Block' };
}

export function DashboardPage({ onToast, onOfflineDetected }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micUnavailable, setMicUnavailable] = useState(false);
  const [micError, setMicError] = useState('');
  const [inputChannel, setInputChannel] = useState<'mic' | 'typed'>('typed');
  const [sending, setSending] = useState(false);
  const [assistantResult, setAssistantResult] = useState<VoiceCommandResponse | null>(null);

  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [verifyingStepUp, setVerifyingStepUp] = useState(false);

  const [payeeModalOpen, setPayeeModalOpen] = useState(false);
  const [newPayeeName, setNewPayeeName] = useState('');
  const [newPayeeCategory, setNewPayeeCategory] = useState('Personal');
  const [newPayeeAccount, setNewPayeeAccount] = useState('');
  const [savingPayee, setSavingPayee] = useState(false);
  const [paymentPayee, setPaymentPayee] = useState<{ id: string; name: string } | null>(null);
  const paymentPanelRef = useRef<HTMLDivElement | null>(null);

  const beginPayment = (payee: { id: string; name: string }) => {
    setPaymentPayee({ ...payee });
    paymentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);

  const loadDashboard = async () => {
    try {
      const res = await apiClient.getDashboard();
      setData(res);
      onOfflineDetected(false);
    } catch (err) {
      if (err instanceof ApiError && err.isOffline) onOfflineDetected(true);
      onToast(err instanceof Error ? err.message : 'Could not load dashboard.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    return () => {
      keepListeningRef.current = false;
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
      }
      recognitionRef.current?.stop();
    };
  }, []);

  const submitCommand = async (text: string, channel: 'mic' | 'typed') => {
    const clean = text.trim();
    if (!clean) return;
    setSending(true);
    try {
      const res = await apiClient.sendVoiceCommand(clean, channel);
      setAssistantResult(res);
      onOfflineDetected(false);

      if (res.requiresPassphrase && res.challengeId) {
        setChallengeId(res.challengeId);
        setPassphraseInput('');
        setStepUpError(null);
        setStepUpOpen(true);
      } else if (res.decision === 'allow') {
        if (data && res.updatedBalanceCents !== undefined) {
          setData({
            ...data,
            balanceCents: res.updatedBalanceCents,
            transactions: res.newTransaction
              ? [res.newTransaction, ...data.transactions]
              : data.transactions,
          });
        }
        onToast('Request verified and completed', 'success');
      } else if (res.decision === 'block') {
        onToast('Sentinel blocked this request for your safety', 'error');
      }
    } catch (err) {
      if (err instanceof ApiError && err.isOffline) onOfflineDetected(true);
      onToast(err instanceof Error ? err.message : 'Unable to process command.', 'error');
    } finally {
      setSending(false);
    }
  };

  const toggleVoiceMic = async () => {
    if (isListening) {
      keepListeningRef.current = false;
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    setMicUnavailable(false);
    setMicError('');
    if (!window.isSecureContext) {
      setMicUnavailable(true);
      setMicError('Open this app at http://localhost:3000 or an HTTPS address to use the microphone.');
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicUnavailable(true);
      setMicError('This browser does not support speech recognition. Open http://localhost:3000 in Google Chrome or Microsoft Edge and allow microphone access.');
      onToast('Live browser speech is unavailable — use the typed assistant below.', 'info');
      return;
    }

    try {
      let completedText = transcript.trim();
      let currentText = '';
      const recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const spoken = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? '')
          .join(' ');
        currentText = spoken;
        setTranscript([completedText, spoken].filter(Boolean).join(' '));
        setInputChannel('mic');
        setMicUnavailable(false);
      };
      recognition.onerror = (event) => {
        // Silence ends a recognition session, not the user's capture.
        if (event.error === 'no-speech') return;
        if (event.error === 'aborted' && !keepListeningRef.current) return;
        keepListeningRef.current = false;
        setIsListening(false);
        setMicUnavailable(true);
        const messages: Record<string, string> = {
          'not-allowed': 'Microphone permission is blocked. Use the site settings beside the address bar to allow Microphone, then press Speak again.',
          'service-not-allowed': 'This browser blocked its speech service. Try Google Chrome at http://localhost:3000 and allow microphone access.',
          'audio-capture': 'No working microphone was found. Select your microphone in Windows sound settings, close other recording apps, and retry.',
          'network': 'The browser speech service could not connect. Check your internet connection and retry in Google Chrome. This is not a microphone hardware error.',
        };
        setMicError(messages[event.error] || `Speech input stopped (${event.error}). Press Speak to retry.`);
      };
      recognition.onend = () => {
        completedText = [completedText, currentText].filter(Boolean).join(' ');
        currentText = '';
        if (!keepListeningRef.current) {
          setIsListening(false);
          return;
        }
        restartTimerRef.current = window.setTimeout(() => {
          if (!keepListeningRef.current) return;
          try { recognition.start(); }
          catch {
            keepListeningRef.current = false;
            setIsListening(false);
            setMicUnavailable(true);
            setMicError('Speech input could not restart. Press Speak to continue.');
          }
        }, 250);
      };
      recognitionRef.current = recognition;
      keepListeningRef.current = true;
      recognition.start();
      setIsListening(true);
    } catch {
      keepListeningRef.current = false;
      setMicUnavailable(true);
      setMicError('Could not start speech input. Check microphone permissions and press Speak again.');
      setIsListening(false);
    }
  };

  const handleVerifyStepUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) return;
    setStepUpError(null);
    setVerifyingStepUp(true);
    try {
      const res = await apiClient.verifyStepUp(challengeId, passphraseInput);
      setAssistantResult(res);
      setStepUpOpen(false);
      if (data && res.updatedBalanceCents !== undefined) {
        setData({
          ...data,
          balanceCents: res.updatedBalanceCents,
          transactions: res.newTransaction
            ? [res.newTransaction, ...data.transactions]
            : data.transactions,
        });
      }
      onToast('Passphrase confirmed — transfer completed', 'success');
    } catch (err) {
      setStepUpError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setVerifyingStepUp(false);
    }
  };

  const handleAddPayee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPayee || newPayeeName.trim().length < 2) return;
    if (newPayeeAccount && !/^\d{4}$/.test(newPayeeAccount)) {
      onToast('Enter exactly four digits for the account reference, or leave it empty.', 'error'); return;
    }
    setSavingPayee(true);
    try {
      const { payee } = await apiClient.addPayee({
        name: newPayeeName,
        category: newPayeeCategory,
        accountHint: newPayeeAccount ? `···· ${newPayeeAccount}` : 'Not provided',
      });
      if (data) {
        setData({ ...data, payees: [...data.payees, payee] });
      }
      setNewPayeeName('');
      setNewPayeeAccount('');
      setPayeeModalOpen(false);
      beginPayment(payee);
      onToast(`${payee.name} added to your payees`, 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not add payee.', 'error');
    } finally {
      setSavingPayee(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-56 lg:col-span-5" />
          <Skeleton className="h-56 lg:col-span-7" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-base text-[var(--ink-muted)]">Unable to load your account right now.</p>
        <Button className="mt-4" onClick={loadDashboard}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Balance & Protection Card */}
        <Card className="lg:col-span-5 flex flex-col justify-between bg-[var(--ink)] text-[var(--bg-paper)] border-[var(--ink)]">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-base">
              <span>{data.accountNumberMasked}</span>
              <span className="border border-[var(--bg-paper)] px-2.5 py-0.5 uppercase">
                Allow · Protected
              </span>
            </div>
            <div className="mt-4 font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              INR {(data.balanceCents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="mt-2 text-base opacity-85">{data.protectionSummary} (Demo account)</p>
          </CardHeader>
          <CardContent className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPayeeModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add payee
            </Button>
          </CardContent>
        </Card>

        {/* Voice Assistant Card */}
        <Card className="lg:col-span-7">
          <CardHeader className="border-b border-[var(--ink)]">
            <CardTitle className="text-3xl font-black">Voice risk assessment</CardTitle>
            <CardDescription className="font-serif-italic text-lg">
              Analyze real audio through the Python pipeline. Identity, authenticity, and instruction risk are separate checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div ref={paymentPanelRef}>
              <AudioAnalysisPanel onPaymentCompleted={loadDashboard} payees={data.payees} requestedPayee={paymentPayee} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions & Payees */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader className="border-b border-[var(--ink)]">
            <CardTitle className="text-3xl font-black">Recent transactions</CardTitle>
            <CardDescription className="font-serif-italic text-lg">
              Verification status and timestamp for each ledger entry.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {data.transactions.length === 0 ? (
              <p className="py-6 text-base text-[var(--ink-muted)]">No transactions yet.</p>
            ) : (
              <div className="divide-y divide-[var(--ink)]">
                {data.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--ink)] text-[var(--ink)]">
                        {tx.direction === 'credit' ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-[var(--ink)]">
                          {tx.title}
                        </p>
                        <p className="font-mono text-base text-[var(--ink-muted)]">
                          {tx.verificationLabel} · {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-base font-semibold tabular-nums shrink-0 text-[var(--ink)]">
                      {tx.direction === 'credit' ? '+' : '-'} INR
                      {(tx.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="border-b border-[var(--ink)]">
            <CardTitle className="text-3xl font-black">Saved payees</CardTitle>
            <CardDescription className="font-serif-italic text-lg">
              Saved recipients require a fresh owner voice check and transfer confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.payees.map((payee) => (
              <div
                key={payee.id}
                className="flex items-center justify-between gap-2 border border-[var(--ink)] px-3.5 py-3"
              >
                <div>
                  <p className="text-base font-medium text-[var(--ink)]">{payee.name}</p>
                  <p className="font-mono text-base text-[var(--ink-muted)]">
                    {payee.category} · {payee.accountHint}
                  </p>
                </div>
                <StatusBadge
                  kind={payee.trusted ? 'allow' : 'step_up'}
                  label={payee.trusted ? 'Allow' : 'Step up'}
                />
                <Button size="sm" variant="outline" onClick={() => beginPayment(payee)} aria-label={`Pay ${payee.name}`}>
                  <Send className="h-4 w-4" /> Pay
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Step-up verification modal */}
      <ModalDialog
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        title="Confirm your personal passphrase"
        description="For your protection, enter your personal passphrase to approve this request."
      >
        <form onSubmit={handleVerifyStepUp} className="space-y-4">
          {stepUpError && (
            <div
              role="alert"
              className="border border-[var(--accent-red)] bg-[var(--accent-red)] px-3.5 py-2.5 font-mono text-base font-medium text-[var(--bg-paper)]"
            >
              {stepUpError}
            </div>
          )}
          <div>
            <label htmlFor="stepup-passphrase" className="block font-mono text-base font-medium text-[var(--ink)]">
              Personal passphrase
            </label>
            <Input
              id="stepup-passphrase"
              type="password"
              placeholder="Enter your passphrase"
              value={passphraseInput}
              onChange={(e) => setPassphraseInput(e.target.value)}
              className="mt-1.5"
            />
            <p className="mt-1.5 font-mono text-base text-[var(--ink-muted)]">
              Demo passphrase: cedar river horizon
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStepUpOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={verifyingStepUp || !passphraseInput.trim()}>
              {verifyingStepUp ? 'Verifying...' : 'Confirm & send'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Add Payee modal */}
      <ModalDialog
        open={payeeModalOpen}
        onClose={() => setPayeeModalOpen(false)}
        title="Add a new payee"
        description="Speak each field or type it, review the details, then save. Adding a payee does not authorize a transfer."
      >
        <form onSubmit={handleAddPayee} className="space-y-4">
          <div>
            <label htmlFor="payee-name" className="block font-mono text-base font-medium text-[var(--ink)]">
              Recipient name
            </label>
            <Input
              id="payee-name"
              placeholder="e.g. Samira Patel"
              value={newPayeeName}
              onChange={(e) => setNewPayeeName(e.target.value)}
              className="mt-1.5"
            />
            <DictateField label="recipient name" onText={setNewPayeeName} />
          </div>
          <div>
            <label htmlFor="payee-cat" className="block font-mono text-base font-medium text-[var(--ink)]">
              Category
            </label>
            <Input
              id="payee-cat"
              placeholder="Personal, Utilities, Business"
              value={newPayeeCategory}
              onChange={(e) => setNewPayeeCategory(e.target.value)}
              className="mt-1.5"
            />
            <DictateField label="category" onText={setNewPayeeCategory} />
          </div>
          <div>
            <label htmlFor="payee-account" className="block font-mono text-base">Account last four digits (optional)</label>
            <Input id="payee-account" value={newPayeeAccount} maxLength={4} inputMode="numeric" onChange={e => setNewPayeeAccount(e.target.value)} />
            <DictateField label="last four digits" onText={value => {
              const words: Record<string, string> = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
              const digits = value.toLowerCase().replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, word => words[word]).replace(/[\s,.-]/g, '');
              if (/^\d{4}$/.test(digits)) setNewPayeeAccount(digits);
              else onToast('Please say four individual digits, for example one two three four, or type them.', 'error');
            }} />
          </div>
          <p>Voice entry uses local Whisper and no DetectifAI credits. Review spelling before saving. Transfers still require the enrolled owner's verified voice.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPayeeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingPayee || newPayeeName.trim().length < 2}>{savingPayee ? 'Saving…' : 'Review & save payee'}</Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
