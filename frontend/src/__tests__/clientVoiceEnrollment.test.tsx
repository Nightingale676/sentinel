import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ClientVoiceEnrollment } from '../components/ClientVoiceEnrollment';
import { clientApi } from '../lib/client-api';

vi.mock('../lib/client-api', () => ({ clientApi: { enrollVoice: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function fill() {
  fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Asha Rao' } });
  fireEvent.change(screen.getByLabelText('Customer reference'), { target: { value: 'CUST-001' } });
  fireEvent.change(screen.getByLabelText('Enrollment recording'), { target: { files: [new File(['voice'], 'voice.wav', { type: 'audio/wav' })] } });
}

it('requires consent and refreshes the real registry only after enrollment succeeds', async () => {
  vi.mocked(clientApi.enrollVoice).mockResolvedValue({ item: {} as any });
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(<ClientVoiceEnrollment onEnrolled={refresh} />);
  fill();
  expect(screen.getByRole('button', { name: 'Enroll customer voice' })).toBeDisabled();
  expect(clientApi.enrollVoice).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Enroll customer voice' })).toBeEnabled();
  fireEvent.submit(screen.getByRole('form', { name: 'Enroll customer voice' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(clientApi.enrollVoice).toHaveBeenCalledWith(expect.objectContaining({ customerName: 'Asha Rao', customerReference: 'CUST-001', consent: true, suffix: '.wav' }));
  expect(screen.getByText('Customer voice enrolled successfully.')).toBeInTheDocument();
});

it('shows provider failure without creating an enrollment in the displayed registry', async () => {
  vi.mocked(clientApi.enrollVoice).mockRejectedValue(new Error('Voice enrollment did not complete.'));
  const refresh = vi.fn();
  render(<ClientVoiceEnrollment onEnrolled={refresh} />);
  fill();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('form', { name: 'Enroll customer voice' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Voice enrollment did not complete.');
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.queryByText('Customer voice enrolled successfully.')).not.toBeInTheDocument();
});
