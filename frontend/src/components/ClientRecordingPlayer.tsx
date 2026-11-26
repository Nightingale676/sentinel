import React, { useState } from 'react';

export function ClientRecordingPlayer({ recordingId, isAdmin }: { recordingId?: string; isAdmin: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!recordingId) return <span className="text-[var(--ink-muted)]">No retained recording</span>;
  if (!isAdmin) return <span className="text-[var(--ink-muted)]">Admin access required for playback</span>;
  if (failed) return <span role="alert">Recording unavailable. Refresh or sign in again.</span>;
  return <audio aria-label="Play consented security recording" controls preload="none" className="max-w-full" src={`/api/client/recordings/${encodeURIComponent(recordingId)}`} onError={() => setFailed(true)} />;
}
