import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/src/lib/api-client';
import { Button } from '@/src/components/ui/button';

/** Records actual audio and uses local Whisper; never submits a payment. */
export function DictateField({ label, onText }: { label: string; onText: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const capture = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; generation.current++;
      if (capture.current?.state === 'recording') capture.current.stop();
      stream.current?.getTracks().forEach(t => t.stop());
    };
  }, []);
  const stop = () => {
    generation.current++;
    capture.current?.state === 'recording' && capture.current.stop();
    stream.current?.getTracks().forEach(t => t.stop());
    setRecording(false);
  };
  const start = async () => {
    const id = ++generation.current;
    setError(''); setRecording(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
        throw new Error('Microphone recording requires Chrome or Edge on localhost or HTTPS.');
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || generation.current !== id) { input.getTracks().forEach(t => t.stop()); return; }
      stream.current = input;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t));
      const recorder = mime ? new MediaRecorder(input, { mimeType: mime }) : new MediaRecorder(input);
      capture.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        input.getTracks().forEach(t => t.stop());
        if (!alive.current) return;
        setBusy(true); setRecording(false);
        try {
          const audio = new Blob(chunks, { type: recorder.mimeType });
          if (!audio.size || audio.size > 12 * 1024 * 1024) throw new Error('Record a short, clear field value (under 60 seconds).');
          const encoded = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = () => reject(new Error('Unable to read recording.'));
            reader.readAsDataURL(audio);
          });
          const suffix = recorder.mimeType.includes('mp4') ? '.m4a' : recorder.mimeType.includes('ogg') ? '.ogg' : '.webm';
          const result = await apiClient.analyze({ audio: encoded, suffix, live: false });
          if (alive.current) onTextRef.current(result.transcript.trim().replace(/[.!?]+$/, ''));
        } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Transcription failed.'); }
        finally { if (alive.current) setBusy(false); }
      };
      recorder.onerror = () => { stop(); setError('Recording failed. Check your microphone.'); };
      recorder.start(250);
    } catch (err) {
      if (alive.current && generation.current === id) {
        setRecording(false); setError(err instanceof Error ? err.message : 'Allow microphone access and retry.');
      }
    }
  };
  return <div className="mt-2 space-y-1">
    <Button type="button" variant="outline" disabled={busy} onClick={recording ? stop : start}
      aria-label={`${recording ? 'Stop dictating' : 'Dictate'} ${label}`}>
      {busy ? 'Transcribing…' : recording ? 'Stop' : `Speak ${label}`}
    </Button>
    {recording && <p role="status">Say only the {label}, then press Stop.</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
