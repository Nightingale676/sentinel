import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DictateField } from '../components/DictateField';
import { apiClient } from '../lib/api-client';

vi.mock('../lib/api-client', () => ({ apiClient: { analyze: vi.fn() } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('transcribes a field without live checks and only fills it after Stop', async () => {
  const stopTrack = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
  class Recorder {
    static isTypeSupported() { return true; }
    mimeType = 'audio/webm'; state = 'inactive';
    ondataavailable: any; onstop: any; onerror: any;
    start() { this.state = 'recording'; this.ondataavailable({ data: new Blob(['audio']) }); }
    stop() { this.state = 'inactive'; this.onstop(); }
  }
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.mocked(apiClient.analyze).mockResolvedValue({ transcript: 'Maya Chen.' } as any);
  const fill = vi.fn();
  render(<DictateField label="recipient name" onText={fill} />);
  fireEvent.click(screen.getByRole('button', { name: 'Dictate recipient name' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Stop dictating recipient name' })).toBeEnabled());
  // Allow the microphone permission promise to resolve before stopping.
  await waitFor(() => expect(screen.getByText('Say only the recipient name, then press Stop.')).toBeInTheDocument());
  expect(fill).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Stop dictating recipient name' }));
  await waitFor(() => expect(fill).toHaveBeenCalledWith('Maya Chen'));
  expect(apiClient.analyze).toHaveBeenCalledWith(expect.objectContaining({ live: false, suffix: '.webm' }));
  expect(stopTrack).toHaveBeenCalled();
});
