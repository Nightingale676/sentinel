import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ClientRecordingPlayer } from '../components/ClientRecordingPlayer';

afterEach(cleanup);
it('shows no playback for unavailable recordings and viewer sessions', () => {
  const view = render(<ClientRecordingPlayer isAdmin recordingId={undefined} />);
  expect(screen.getByText('No retained recording')).toBeInTheDocument();
  view.rerender(<ClientRecordingPlayer isAdmin={false} recordingId="private-id" />);
  expect(screen.getByText('Admin access required for playback')).toBeInTheDocument();
  expect(screen.queryByLabelText('Play consented security recording')).not.toBeInTheDocument();
});
it('loads audio through the protected API only on demand and handles unavailable files', () => {
  render(<ClientRecordingPlayer isAdmin recordingId="private-id" />);
  const player = screen.getByLabelText('Play consented security recording');
  expect(player).toHaveAttribute('src', '/api/client/recordings/private-id');
  expect(player).toHaveAttribute('preload', 'none');
  fireEvent.error(player);
  expect(screen.getByRole('alert')).toHaveTextContent('Recording unavailable');
});
