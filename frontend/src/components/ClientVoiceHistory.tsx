import React, { useState } from 'react';
import type { VoiceRecordingEntry } from '../lib/client-portal-service';
import { ClientRecordingPlayer } from './ClientRecordingPlayer';

export function ClientVoiceHistory({ entries, isAdmin }: { entries: VoiceRecordingEntry[]; isAdmin: boolean }) {
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState(false);
  const blocked = entries.filter(entry => entry.status === 'Blocked').length;
  const visible = filter === 'All' ? entries : entries.filter(entry => entry.status === filter);
  return <details className="min-w-[280px] max-w-[420px] text-left" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer font-medium">Recording history ({entries.length}) · {blocked} blocked</summary>
    {open && <div className="mt-3 space-y-3">
      <p className="text-sm">Attempts are recorded against this account; a rejected recording does not identify its speaker.</p>
      <label className="block">Show recordings
        <select aria-label="Filter recording history" className="ml-2 border bg-[var(--bg-paper)] p-1" value={filter} onChange={event => setFilter(event.target.value)}>
          <option>All</option><option>Blocked</option><option>Suspicious</option><option>Allowed</option><option>Enrollment</option>
        </select>
      </label>
      {visible.length === 0 && <p>No {filter.toLowerCase()} attempts recorded for this account.</p>}
      {visible.map(entry => <div key={entry.id} className="space-y-2 border border-[var(--ink)] p-3">
        <p><strong>{entry.status}</strong> · {entry.action}</p>
        <p className="font-mono text-sm">{new Date(entry.timestamp).toLocaleString()}</p>
        <p className="text-sm">{entry.reason}</p>
        <ClientRecordingPlayer recordingId={entry.recordingId} isAdmin={isAdmin} />
        {entry.transcript && <p className="text-sm"><strong>Transcript:</strong> {entry.transcript}</p>}
      </div>)}
    </div>}
  </details>;
}
