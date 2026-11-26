import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OnboardingWizard } from '../pages/OnboardingWizard';

vi.mock('../components/AudioAnalysisPanel', () => ({ AudioAnalysisPanel: ({ onOwnerEnrolled }: { onOwnerEnrolled: () => void }) => <button onClick={onOwnerEnrolled}>Complete real enrollment</button> }));
afterEach(cleanup);

it('requires real enrollment even if the old demo phrase count was completed', () => {
  render(<OnboardingWizard user={{ voiceEnrolledCount: 3 } as any} onUserUpdated={vi.fn()} onComplete={vi.fn()} onToast={vi.fn()} />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Complete real enrollment' }));
  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByLabelText('Personal passphrase (3 memorable words)')).toBeInTheDocument();
});
