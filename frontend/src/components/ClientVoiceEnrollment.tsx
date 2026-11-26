import React, { useState } from 'react';
import { clientApi } from '../lib/client-api';
import { Button } from './ui/button';

export function ClientVoiceEnrollment({ onEnrolled }: { onEnrolled: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return <form aria-label="Enroll customer voice" className="space-y-3 border border-[var(--ink)] p-4" onSubmit={async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (busy || !file || !consent) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (!file.size || file.size > 12 * 1024 * 1024) throw new Error('Choose a nonempty recording smaller than 12 MB.');
      const audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read recording.'));
        reader.readAsDataURL(file);
      });
      await clientApi.enrollVoice({ customerName: name.trim(), customerReference: reference.trim(), consent,
        audio, suffix: '.' + file.name.split('.').pop()!.toLowerCase() });
      setMessage('Customer voice enrolled successfully.');
      setName(''); setReference(''); setConsent(false); setFile(null);
      form.reset();
      await onEnrolled();
    } catch (err) { setError(err instanceof Error ? err.message : 'Enrollment failed.'); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-display text-2xl">Enroll a customer voice</h3>
    <p>Upload 15–60 seconds of one customer speaking clearly (25–30 seconds recommended). This sends audio to DetectifAI and uses enrollment credits. Recordings are temporary and cannot be played from this registry.</p>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block">Customer name<input required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} className="block border p-2 bg-transparent" /></label>
      <label className="block">Customer reference<input required pattern={'[A-Za-z0-9_\\-]{2,60}'} maxLength={60} value={reference} onChange={e => setReference(e.target.value)} className="block border p-2 bg-transparent" /></label>
      <label className="block">Enrollment recording<input required type="file" accept=".wav,.m4a,.mp3,.webm,.ogg,.flac,.mp4" onChange={e => { setFile(e.target.files?.[0] || null); setMessage(''); }} className="block" /></label>
      <label className="flex gap-2"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />The customer explicitly consented to storing a voice profile with DetectifAI for identity verification and displaying their name and reference to this organization.</label>
      <Button type="submit" disabled={busy || !file || !consent || name.trim().length < 2 || reference.trim().length < 2}>{busy ? 'Enrolling voice…' : 'Enroll customer voice'}</Button>
    </fieldset>
    {busy && <p role="status">Enrolling with the voice provider. Please keep this page open.</p>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </form>;
}
