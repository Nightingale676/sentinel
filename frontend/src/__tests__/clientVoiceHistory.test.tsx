import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ClientVoiceHistory } from '../components/ClientVoiceHistory';
import type { VoiceRecordingEntry } from '../lib/client-portal-service';

afterEach(cleanup);
const original: VoiceRecordingEntry = { id: 'enroll', recordingId: 'original-audio', timestamp: '2026-11-26T01:00:00Z', action: 'Original voice enrollment', status: 'Enrollment', reason: 'Original sample.' };
const blocked: VoiceRecordingEntry = { id: 'blocked', recordingId: 'blocked-audio', timestamp: '2026-11-26T02:00:00Z', action: 'Voice payment attempt', status: 'Blocked', reason: 'Voice mismatch.' };

it('shows original and blocked audio separately and preserves the original player when later recordings arrive', () => {
  const view = render(<ClientVoiceHistory entries={[original, blocked]} isAdmin />);
  const details = screen.getByText('Recording history (2) · 1 blocked').closest('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  const players = screen.getAllByLabelText('Play consented security recording');
  expect(players[0]).toHaveAttribute('src', '/api/client/recordings/original-audio');
  expect(players[1]).toHaveAttribute('src', '/api/client/recordings/blocked-audio');
  view.rerender(<ClientVoiceHistory entries={[original, blocked, { ...blocked, id: 'later', recordingId: 'later-audio' }]} isAdmin />);
  expect(screen.getAllByLabelText('Play consented security recording')).toHaveLength(3);
  expect(screen.getAllByLabelText('Play consented security recording')[0]).toBe(players[0]);
  fireEvent.change(screen.getByLabelText('Filter recording history'), { target: { value: 'Blocked' } });
  expect(screen.queryByText('Original voice enrollment')).not.toBeInTheDocument();
  expect(screen.getAllByText('Voice mismatch.')).toHaveLength(2);
});

it('keeps blocked attempts visible even when audio retention consent was not given', () => {
  render(<ClientVoiceHistory entries={[{ ...blocked, recordingId: undefined }]} isAdmin />);
  const details = screen.getByText('Recording history (1) · 1 blocked').closest('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  expect(screen.getByText('Voice mismatch.')).toBeInTheDocument();
  expect(screen.getByText('No retained recording')).toBeInTheDocument();
});
