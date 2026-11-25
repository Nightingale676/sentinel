import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ModalDialog } from '../components/ui/dialog';

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('keeps the passphrase focused across typing updates and spaces', () => {
  vi.useFakeTimers();
  function Passphrase() {
    const [value, setValue] = useState('');
    return <ModalDialog open onClose={() => {}} title="Confirm passphrase">
      <input aria-label="Passphrase" value={value} onChange={e => setValue(e.target.value)} />
    </ModalDialog>;
  }
  render(<Passphrase />);
  act(() => { vi.advanceTimersByTime(30); });
  const input = screen.getByLabelText('Passphrase');
  fireEvent.focus(input);
  (input as HTMLInputElement).focus();
  for (const value of ['cedar', 'cedar ', 'cedar river', 'cedar river horizon']) {
    fireEvent.change(input, { target: { value } });
    act(() => { vi.advanceTimersByTime(30); });
    expect(input).toHaveFocus();
    expect(input).toHaveValue(value);
  }
});

it('uses the latest close callback without resetting focus', () => {
  const first = vi.fn();
  const latest = vi.fn();
  const view = render(<ModalDialog open onClose={first} title="Test">Content</ModalDialog>);
  view.rerender(<ModalDialog open onClose={latest} title="Test">Content</ModalDialog>);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
});
