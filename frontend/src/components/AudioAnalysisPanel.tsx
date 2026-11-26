import React, { useEffect, useRef, useState } from 'react';
import { apiClient, type AnalysisResponse, type CustomerUser } from '@/src/lib/api-client';
import { Button } from '@/src/components/ui/button';

export function AudioAnalysisPanel({ onPaymentCompleted, payees = [], requestedPayee, onLoginVerified, onOwnerEnrolled }: { onPaymentCompleted?: () => void; payees?: { id: string; name: string }[]; requestedPayee?: { id: string; name: string } | null; onLoginVerified?: (user: CustomerUser) => void; onOwnerEnrolled?: () => void }) {
  const [purpose, setPurpose] = useState<'enroll' | 'payment' | 'analysis'>('enroll');
  const [enrolled, setEnrolled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [registryConsent, setRegistryConsent] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [registryLinked, setRegistryLinked] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [notice, setNotice] = useState('');
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [suffix, setSuffix] = useState('.webm');
  const [url, setUrl] = useState('');
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<(AnalysisResponse & { transferStatus?: 'submitting' | 'completed' | 'failed' }) | null>(null);
  const [text, setText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (!requestedPayee) return;
    if (recorder.current?.state === 'recording') return;
    setPurpose('payment');
    setAudio(null); setResult(null); setError('');
    setNotice(`Pay ${requestedPayee.name}: record a fresh request with the amount in rupees and this full name. Stop recording, then press Run to verify it.`);
  }, [requestedPayee]);

  useEffect(() => {
    apiClient.voiceProfile().then(profile => { if (mounted.current) {
      setEnrolled(profile.enrolled);
      setRegistryLinked(profile.registryLinked === true);
      setOrganizationName(profile.organizationName || '');
      if (profile.enrolled) { setPurpose(onOwnerEnrolled ? 'enroll' : 'payment'); onOwnerEnrolled?.(); }
    } })
      .catch(() => { if (mounted.current) setError('Could not load voice enrollment status. Refresh or sign in again.'); });
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current++;
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach(t => t.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!audio) { setUrl(''); return; }
    const next = URL.createObjectURL(audio);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [audio]);

  const stop = () => {
    sequence.current++;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(t => t.stop());
    if (timer.current) clearInterval(timer.current);
    setRecording(false);
  };

  const start = async () => {
    const id = ++sequence.current;
    setError(''); setNotice(''); setResult(null); setAudio(null); setRecording(true); setSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Use Chrome or Edge at http://localhost:3000, or upload a recording below.');
      }
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || id !== sequence.current) { input.getTracks().forEach(t => t.stop()); return; }
      stream.current = input;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t));
      const capture = mime ? new MediaRecorder(input, { mimeType: mime }) : new MediaRecorder(input);
      recorder.current = capture;
      const chunks: Blob[] = [];
      capture.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      capture.onstop = () => {
        input.getTracks().forEach(t => t.stop());
        if (!mounted.current) return;
        const blob = new Blob(chunks, { type: capture.mimeType });
        setAudio(blob);
        setNotice(blob.size ? (purpose === 'payment' ? 'Recording ready. Press Run to verify your payment request, then review and confirm the transfer.' : 'Recording ready. Submit it using the button below.') : 'No audio was captured. Record your request again.');
        setSuffix(capture.mimeType.includes('mp4') ? '.m4a' : capture.mimeType.includes('ogg') ? '.ogg' : '.webm');
      };
      capture.onerror = () => { stop(); setError('Recording failed. Check your microphone or upload an audio file.'); };
      capture.start(250);
      const began = Date.now();
      timer.current = setInterval(() => setSeconds(Math.floor((Date.now() - began) / 1000)), 250);
    } catch (err) {
      if (mounted.current && id === sequence.current) {
        setRecording(false);
        setError(err instanceof Error ? err.message : 'Allow microphone access in your browser site settings.');
        stream.current?.getTracks().forEach(t => t.stop());
      }
    }
  };

  const analyze = async (textOnly = false) => {
    setBusy(true); setError(''); setNotice(''); setResult(null);
    try {
      let payload: { text?: string; audio?: string; suffix?: string; live?: boolean };
      if (textOnly) payload = { text };
      else {
        if (!audio || audio.size > 12 * 1024 * 1024) throw new Error('Choose a recording smaller than 12 MB.');
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error('Could not read recording.'));
          reader.readAsDataURL(audio);
        });
        payload = { audio: base64, suffix, live };
      }
      if (onLoginVerified) {
        const response = await apiClient.verifyVoiceLogin({ audio: payload.audio!, suffix: payload.suffix!, recordingConsent });
        if (response.verified !== true) throw new Error('Voice sign-in did not complete.');
        onLoginVerified(response.user);
        return;
      }
      if (!textOnly && purpose === 'enroll') {
        if (!consent) throw new Error('Give consent before enrolling your voice.');
        const response = await apiClient.enrollOwner({ audio: payload.audio!, suffix: payload.suffix!, consent, registryConsent, recordingConsent });
        if (mounted.current) {
          if (response.enrolled !== true) throw new Error('Enrollment did not complete. Payments remain blocked.');
          setEnrolled(true); setAudio(null); setPurpose(onOwnerEnrolled ? 'enroll' : 'payment'); onOwnerEnrolled?.();
          setRegistryLinked(registryConsent);
          setNotice(onOwnerEnrolled ? 'Owner voice enrolled successfully. You can continue setup below.' : 'Verified: owner voice registered with consent. Use Speak below to record a new payment request, then press Run.');
        }
        return;
      }
      const response = !textOnly && purpose === 'payment'
        ? await apiClient.checkPayment({ audio: payload.audio!, suffix: payload.suffix!, recordingConsent })
        : await apiClient.analyze(payload);
      if (mounted.current) setResult(response);
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Analysis failed.'); }
    finally { if (mounted.current) setBusy(false); }
  };

  return <section aria-label="Real recording analysis" className="space-y-4 border border-[var(--ink)] bg-[var(--bg-paper)] p-5 text-[var(--ink)]">
    <h2 className="font-display text-3xl">{onLoginVerified ? 'Verify your voice to finish signing in' : 'Owner voice payment protection'}</h2>
    {onLoginVerified && <p>Record 8–15 seconds of your own voice, then press Verify sign-in. Your existing profile is reused. Live speaker and authenticity checks upload audio to DetectifAI and use credits. This check cannot send money.</p>}
    <p role="status"><strong>{enrolled ? 'Verified: owner voice registered.' : 'Not verified: enroll the owner voice first.'}</strong> {enrolled ? 'Each payment must match this person in a fresh voice check.' : 'All payments are blocked until enrollment succeeds.'}</p>
    {!onLoginVerified && !onOwnerEnrolled && <fieldset className="space-y-2"><legend>Choose a task</legend>
      {([['enroll', 'Enroll owner voice'], ['payment', 'Voice payment assistant'], ['analysis', 'Risk analysis only']] as const).map(([value, label]) =>
        <label key={value} className="mr-4 inline-flex gap-2"><input type="radio" name="voice-task" value={value} checked={purpose === value} disabled={busy || recording}
          onChange={() => { setPurpose(value); setAudio(null); setResult(null); setNotice(''); setError(''); }} />{label}</label>)}
    </fieldset>}
    {!onLoginVerified && (purpose === 'enroll' ? <>
      <p>Record the account owner's voice for 25–30 seconds (15–60 seconds accepted). This enrolls a real Eidos voice profile and spends credits. An enrolled owner cannot be replaced here.</p>
      <label className="flex gap-2"><input type="checkbox" checked={consent} disabled={busy || enrolled} onChange={e => setConsent(e.target.checked)} />
        I am the account owner and consent to storing my voice profile with DetectifAI to verify my payment requests.</label>
    </> : purpose === 'payment' ? <>
      <h3 className="font-display text-2xl">Voice payment assistant</h3>
      <p>After saving a payee: Speak, say “Transfer fifty rupees to {requestedPayee?.name || payees[0]?.name || 'the full saved payee name'}”, Stop, then Run. When verification succeeds, confirm the transfer below.</p>
      {payees.length > 0 && <p>Available payees: {payees.map(payee => payee.name).join(', ')}.</p>}
      <p>This replaces the legacy Speak / Run simulation. Speak records actual audio; Run verifies the speaker before any payment can proceed.</p>
      <p>Record a fresh 8–15 second request. Say one amount in rupees and the full name of a saved payee, for example: “Transfer fifty rupees to Maya Chen.”</p>
      <p>Live Eidos and Aletheia checks upload audio and spend credits. A mismatch, synthetic speech, or a failed check blocks payment. Review the amount and recipient before confirming.</p>
    </> : <p>Risk analysis cannot authorize payments. It uses customer_001 for the earlier saved examples.</p>)}
    {!onLoginVerified && organizationName && !registryLinked && <div className="space-y-2 border p-3">
      <label className="flex gap-2"><input type="checkbox" checked={registryConsent} disabled={busy || recording} onChange={e => setRegistryConsent(e.target.checked)} />
        I consent to showing my enrolled voice profile, account name, customer reference, and verification dates to {organizationName} in its Voices registry. Audio playback requires the separate recording-retention consent below.</label>
      {enrolled && <Button type="button" disabled={!registryConsent || busy || recording} onClick={async () => {
        setBusy(true); setError('');
        try { await apiClient.linkVoiceRegistry(); setRegistryLinked(true); setNotice(`Your enrolled profile is now listed in ${organizationName}'s Voices registry.`); }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not link your voice profile.'); }
        finally { setBusy(false); }
      }}>Show my enrolled voice in registry</Button>}
    </div>}
    {!onLoginVerified && registryLinked && <p>Your enrolled profile appears in {organizationName}'s Voices registry.</p>}
    <p>Capture continues until Stop. Maximum analysis duration is 60 seconds. Enrollment is saved for this account; a new payment always needs a fresh recording.</p>
    {(onLoginVerified || purpose !== 'analysis') && <label className="flex gap-2 border p-3"><input type="checkbox" checked={recordingConsent} disabled={busy || recording} onChange={e => setRecordingConsent(e.target.checked)} />
      I consent to retaining this recording privately for {organizationName || 'my linked organization'} admins to play during security review, including blocked or suspicious attempts. Without this consent, the recording is not retained for playback. Audio remains stored until removed by the operator.</label>}
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" disabled={busy} onClick={recording ? stop : start}>{recording ? 'Stop' : purpose === 'payment' ? 'Speak' : 'Record audio'}</Button>
      {recording && <span role="status">Recording: {seconds}s</span>}
      <label>Upload recording <input aria-label="Upload recording for analysis" type="file" accept=".wav,.m4a,.mp3,.webm,.ogg,.flac,.mp4" disabled={recording || busy}
        onChange={e => {
          const file = e.target.files?.[0]; setResult(null); setError('');
          if (!file) { setAudio(null); return; }
          if (file.size > 12 * 1024 * 1024) { setAudio(null); setError('Maximum file size is 12 MB.'); return; }
          setAudio(file); setSuffix('.' + file.name.split('.').pop()?.toLowerCase());
        }} /></label>
    </div>
    {url && <audio aria-label="Preview your recording" controls src={url} />}
    {purpose === 'analysis' && <label className="flex items-start gap-2"><input type="checkbox" checked={live} disabled={busy || recording} onChange={e => { setLive(e.target.checked); setResult(null); }} />
      Run live Aletheia + Eidos checks when no saved result exists. This uploads audio to DetectifAI and spends credits.</label>
    }
    <Button type="button" disabled={!audio || recording || busy || (purpose === 'enroll' && (!consent || enrolled || (!!onOwnerEnrolled && !!organizationName && !registryConsent))) || (purpose === 'payment' && !enrolled)} onClick={() => analyze()}>
      {busy ? 'Checking…' : onLoginVerified ? 'Verify sign-in' : purpose === 'enroll' ? 'Submit owner voice' : purpose === 'payment' ? 'Run' : live ? 'Analyze with live checks' : 'Analyze with saved checks'}</Button>
    {purpose === 'analysis' && <><p>Saved mode makes no paid API request. New audio stays unverified unless live checks complete.</p>
    <details><summary>Analyze typed text instead</summary>
      <label className="block">Request text<textarea aria-label="Request text to assess" className="block w-full border p-2 bg-transparent" value={text} disabled={busy || recording} onChange={e => { setText(e.target.value); setResult(null); }} /></label>
      <Button type="button" disabled={!text.trim() || busy || recording} onClick={() => analyze(true)}>Assess text only</Button>
    </details></>}
    {busy && <p role="status">Transcribing locally and assessing the request. First use may download Whisper. Please wait.</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {result && <div role="status" className="space-y-3 border-t border-[var(--ink)] pt-4">
      <h3 className="font-display text-2xl">Assessment</h3>
      {result.payment && <div className="border p-3 space-y-2">
        <p><strong>{result.transferStatus === 'completed' ? 'Payment completed successfully' : result.transferStatus === 'submitting' ? 'Sending payment…' : result.transferStatus === 'failed' ? 'Payment confirmation failed' : result.payment.eligible ? 'Verified owner: payment accepted for confirmation' : 'Payment blocked: voice or request not verified'}</strong></p>
        <p>{result.payment.message}</p>
        {!result.transferStatus && result.payment.eligible && result.payment.authorizationToken && <>
          <p>Send INR {((result.payment.amountCents || 0) / 100).toFixed(2)} to {result.payment.payeeName} from the demo balance?</p>
          <Button disabled={busy} onClick={async () => {
            setBusy(true); setError('');
            const token = result.payment!.authorizationToken!;
            const submittedPayment = { ...result.payment!, authorizationToken: undefined };
            setResult({ ...result, transferStatus: 'submitting', payment: { ...submittedPayment, message: 'Waiting for transfer confirmation.' } });
            try {
              const response = await apiClient.confirmVoiceTransfer(token);
              setResult({ ...result, transferStatus: 'completed', payment: { ...submittedPayment, message: `INR ${(submittedPayment.amountCents! / 100).toFixed(2)} sent to ${submittedPayment.payeeName}. Record a new voice request for another payment.` } });
              setNotice(response.message); onPaymentCompleted?.();
            } catch (err) {
              setResult({ ...result, transferStatus: 'failed', payment: { ...submittedPayment, message: 'Confirmation did not complete. Check your balance and recent transactions before starting another payment.' } });
              setError(err instanceof Error ? err.message : 'Payment confirmation failed.');
            }
            finally { setBusy(false); }
          }}>Confirm verified demo transfer</Button>
        </>}
      </div>}
      <p><strong>Speaker:</strong> {result.report.speaker_status} · <strong>Speech:</strong> {result.report.authenticity_status} · <strong>Action risk:</strong> {result.report.risk_level}</p>
      <p><strong>Transcript:</strong> {result.transcript}</p>
      {result.report.reasons.map(reason => <p key={reason}>{reason}</p>)}
      <p><strong>Guidance:</strong> {result.guidance}</p>
      <Button type="button" onClick={() => {
        if (!window.speechSynthesis) { setError('Speech playback is unavailable in this browser.'); return; }
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(result.guidance));
      }}>Read guidance aloud</Button>
      <p>Source: {result.source}. Credits used this run: {result.credits_used ?? 'unknown'}.</p>
      {result.warnings.map(w => <p key={w}>{w}</p>)}
      <p>{result.report.limitations} A voice mismatch is a blocked identity check, not proof of fraud. Only a server-verified payment followed by your confirmation can debit the demo balance.</p>
    </div>}
  </section>;
}
