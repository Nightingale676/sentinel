import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AudioAnalysisPanel } from '../components/AudioAnalysisPanel';
import { apiClient } from '../lib/api-client';

vi.mock('../lib/api-client', () => ({ apiClient: { analyze: vi.fn(), voiceProfile: vi.fn(), enrollOwner: vi.fn(), checkPayment: vi.fn(), confirmVoiceTransfer: vi.fn(), verifyVoiceLogin: vi.fn(), linkVoiceRegistry: vi.fn() } }));
beforeEach(() => { vi.mocked(apiClient.voiceProfile).mockResolvedValue({ enrolled: false }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it('explains a missing API key before live enrollment and leaves text analysis available', async () => {
  vi.mocked(apiClient.voiceProfile).mockResolvedValue({ enrolled: false, apiKeyConfigured: false });
  render(<AudioAnalysisPanel />);
  expect(await screen.findByRole('alert')).toHaveTextContent('API key not set');
  expect(apiClient.enrollOwner).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('Risk analysis only'));
  fireEvent.change(screen.getByLabelText('Request text to assess'), { target: { value: 'Hello' } });
  expect(screen.getByRole('button', { name: 'Assess text only' })).toBeEnabled();
});

it('uses the existing profile for voice sign-in without enrolling again or checking a payment', async () => {
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => 'blob:login'), revokeObjectURL: vi.fn() }));
  vi.mocked(apiClient.voiceProfile).mockResolvedValue({ enrolled: true });
  const user = { id: 'owner', voiceVerificationRequired: false } as any;
  vi.mocked(apiClient.verifyVoiceLogin).mockResolvedValue({ verified: true, user });
  const verified = vi.fn();
  render(<AudioAnalysisPanel onLoginVerified={verified} />);
  await screen.findByText('Verified: owner voice registered.');
  expect(screen.queryByText('Choose a task')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Upload recording for analysis'), { target: { files: [new File(['login'], 'login.wav', { type: 'audio/wav' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify sign-in' }));
  await waitFor(() => expect(verified).toHaveBeenCalledWith(user));
  expect(apiClient.enrollOwner).not.toHaveBeenCalled();
  expect(apiClient.checkPayment).not.toHaveBeenCalled();
});

it('links an existing enrollment to the registry only after explicit consent', async () => {
  vi.mocked(apiClient.voiceProfile).mockResolvedValue({ enrolled: true, registryLinked: false, organizationName: 'Aarohan Bank India' });
  vi.mocked(apiClient.linkVoiceRegistry).mockResolvedValue({ linked: true });
  render(<AudioAnalysisPanel />);
  const button = await screen.findByRole('button', { name: 'Show my enrolled voice in registry' });
  expect(button).toBeDisabled();
  expect(apiClient.linkVoiceRegistry).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText(/I consent to showing my enrolled voice profile/));
  fireEvent.click(button);
  expect(await screen.findByText("Your enrolled profile appears in Aarohan Bank India's Voices registry.")).toBeInTheDocument();
});

it('takes a selected saved payee through verification and explicit transfer confirmation', async () => {
  vi.stubGlobal('URL', Object.assign(class extends URL {}, {
    createObjectURL: vi.fn(() => 'blob:payment'), revokeObjectURL: vi.fn(),
  }));
  vi.mocked(apiClient.voiceProfile).mockResolvedValue({ enrolled: true });
  vi.mocked(apiClient.checkPayment).mockResolvedValue({
    transcript: 'Pay fifty rupees to Asha Rao',
    payment: { eligible: true, authorizationToken: 'verified-token', amountCents: 5000, payeeName: 'Asha Rao', message: 'Review and confirm.' },
    report: { speaker_status: 'match', authenticity_status: 'genuine', risk_level: 'high', reasons: [], limitations: 'Demo' },
    guidance: 'Confirm the recipient.', source: 'Live checks', warnings: [],
  } as any);
  vi.mocked(apiClient.confirmVoiceTransfer).mockResolvedValue({ message: 'Demo transfer completed.', updatedBalanceCents: 95000 });
  const completed = vi.fn();
  render(<AudioAnalysisPanel requestedPayee={{ id: 'new', name: 'Asha Rao' }} onPaymentCompleted={completed} />);
  await screen.findByText('Verified: owner voice registered.');
  expect(screen.getByText(/Pay Asha Rao: record a fresh request/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Upload recording for analysis'), { target: { files: [new File(['payment'], 'payment.wav', { type: 'audio/wav' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Run' }));
  const confirm = await screen.findByRole('button', { name: 'Confirm verified demo transfer' });
  expect(apiClient.confirmVoiceTransfer).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  expect(await screen.findByText('Demo transfer completed.')).toBeInTheDocument();
  expect(apiClient.confirmVoiceTransfer).toHaveBeenCalledWith('verified-token');
  expect(completed).toHaveBeenCalledOnce();
  expect(screen.getByText('Payment completed successfully')).toBeInTheDocument();
  expect(screen.getByText(/INR 50.00 sent to Asha Rao/)).toBeInTheDocument();
  expect(screen.queryByText('Payment blocked: voice or request not verified')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm verified demo transfer' })).not.toBeInTheDocument();
});

it('assesses typed text without requesting live voice checks', async () => {
  vi.mocked(apiClient.analyze).mockResolvedValue({
    transcript: 'Send my OTP', report: { risk_level: 'high', speaker_status: 'unknown',
      authenticity_status: 'unknown', reasons: ['Security code mentioned'], guidance: 'Keep codes private.',
      limitations: 'Prototype.', intent: { intents: ['security_code_reference'] } },
    guidance: 'Keep codes private.', source: 'Text only', credits_used: 0, warnings: [],
  });
  render(<AudioAnalysisPanel />);
  fireEvent.click(screen.getByLabelText('Risk analysis only'));
  fireEvent.click(screen.getByText('Analyze typed text instead'));
  fireEvent.change(screen.getByLabelText('Request text to assess'), { target: { value: 'Send my OTP' } });
  fireEvent.click(screen.getByRole('button', { name: 'Assess text only' }));
  await waitFor(() => expect(apiClient.analyze).toHaveBeenCalledWith({ text: 'Send my OTP' }));
  expect(await screen.findByText('Security code mentioned')).toBeInTheDocument();
  expect(screen.getByText(/Text only. Credits used this run: 0/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Request text to assess'), { target: { value: 'Changed request' } });
  expect(screen.queryByText('Security code mentioned')).not.toBeInTheDocument();
});

it('shows backend failures without a fabricated safe result', async () => {
  vi.mocked(apiClient.analyze).mockRejectedValue(new Error('Cannot start Python.'));
  render(<AudioAnalysisPanel />);
  fireEvent.click(screen.getByLabelText('Risk analysis only'));
  fireEvent.change(screen.getByLabelText('Request text to assess'), { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: 'Assess text only' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot start Python.');
  expect(screen.queryByRole('heading', { name: 'Assessment' })).not.toBeInTheDocument();
});

it('does not enable paid checks by default', () => {
  render(<AudioAnalysisPanel />);
  fireEvent.click(screen.getByLabelText('Risk analysis only'));
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Analyze with saved checks' })).toBeDisabled();
});

it('opens the Speak / Run payment assistant when an owner is already enrolled', async () => {
  vi.mocked(apiClient.voiceProfile).mockResolvedValue({ enrolled: true });
  render(<AudioAnalysisPanel />);
  expect(await screen.findByText('Verified: owner voice registered.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Speak' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  expect(apiClient.checkPayment).not.toHaveBeenCalled();
});

it('shows verified only after enrollment succeeds, then opens the payment assistant', async () => {
  vi.stubGlobal('URL', Object.assign(class extends URL {}, {
    createObjectURL: vi.fn(() => 'blob:test-audio'), revokeObjectURL: vi.fn(),
  }));
  vi.mocked(apiClient.enrollOwner).mockResolvedValue({ enrolled: true, credits_used: 200 });
  render(<AudioAnalysisPanel />);
  fireEvent.click(screen.getByLabelText(/I am the account owner and consent/));
  const file = new File(['test-audio'], 'owner.wav', { type: 'audio/wav' });
  fireEvent.change(screen.getByLabelText('Upload recording for analysis'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit owner voice' }));
  expect(await screen.findByText('Verified: owner voice registered.')).toBeInTheDocument();
  expect(apiClient.enrollOwner).toHaveBeenCalledWith(expect.objectContaining({ consent: true, suffix: '.wav' }));
  expect(screen.getByRole('button', { name: 'Speak' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  expect(apiClient.checkPayment).not.toHaveBeenCalled();
});
