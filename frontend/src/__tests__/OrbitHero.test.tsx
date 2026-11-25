import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OrbitHero } from '../components/OrbitHero';

describe('OrbitHero', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('renders all three orbiting items (smart glasses, smartphone, aim illustration) plus pause toggle', () => {
    render(<OrbitHero />);

    expect(screen.getByRole('group', { name: /sentinel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /smart glasses verifying voice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /smartphone running sentinel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /illustration showing real voice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause orbit/i })).toBeInTheDocument();
  });

  it('toggles pause orbit state when Pause orbit button is clicked', () => {
    render(<OrbitHero />);

    const pauseBtn = screen.getByRole('button', { name: /pause orbit/i });
    expect(pauseBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pauseBtn);
    const resumeBtn = screen.getByRole('button', { name: /resume orbit/i });
    expect(resumeBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens detail panel when smart glasses or phone node is clicked and calls onLearnMoreSection', async () => {
    const onLearnMore = vi.fn();
    render(<OrbitHero onLearnMoreSection={onLearnMore} />);

    const glassesBtn = screen.getByRole('button', { name: /smart glasses verifying voice/i });
    fireEvent.click(glassesBtn);

    expect(screen.getByText('Smart glasses protection')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /learn more/i }));
    expect(onLearnMore).toHaveBeenCalledWith('protects');

    const phoneBtn = screen.getByRole('button', { name: /smartphone running sentinel/i });
    fireEvent.click(phoneBtn);

    await waitFor(() => {
      expect(screen.getByText('Live mobile dashboard')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /learn more/i }));
    expect(onLearnMore).toHaveBeenCalledWith('simulator');
  });

  it('renders static accessible fallback with all 3 nodes when prefers-reduced-motion is enabled', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<OrbitHero />);
    expect(container.querySelector('[data-reduced-motion="true"]')).toBeInTheDocument();
    expect(screen.getByText('Reduced motion active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /smart glasses verifying voice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /smartphone running sentinel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /illustration showing real voice/i })).toBeInTheDocument();
  });
});

