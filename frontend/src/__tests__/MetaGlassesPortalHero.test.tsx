import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MetaGlassesPortalHero } from '../components/MetaGlassesPortalHero';

describe('MetaGlassesPortalHero', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.scrollTo = vi.fn();
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

  it('renders floating Ray-Ban smart glasses image, headline, and removes old Fig. 0 prompt copy', () => {
    const onGetStarted = vi.fn();
    const onSignIn = vi.fn();
    render(<MetaGlassesPortalHero onGetStarted={onGetStarted} onSignIn={onSignIn} />);

    const img = screen.getByAltText(/Ray-Ban Meta smart glasses secured by Sentinel/i) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('/assets/aistudio/glasses_rayban_cutout.png');
    expect(screen.getByTestId('dimension-warp-tunnel')).toBeInTheDocument();
    expect(screen.queryByText(/Scroll to enter lens dimension/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Scroll to enter the optical dimension/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fig\. 0 —/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Get started/i })[0]);
    expect(onGetStarted).toHaveBeenCalledTimes(1);
  });

  it('transitions into the live Sentinel interface and evaluates live voice commands', () => {
    render(<MetaGlassesPortalHero onGetStarted={vi.fn()} onSignIn={vi.fn()} />);

    const enterBtn = screen.getByRole('button', { name: /Enter lens interface/i });
    fireEvent.click(enterBtn);

    expect(screen.getByTestId('lens-interface-view')).toBeInTheDocument();
    expect(screen.getByText('$14,825.40')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cloned voice wire/i }));
    expect(screen.getAllByText('Block').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: /Send \$950 to Jordan/i }));
    expect(screen.getAllByText('Step up').length).toBeGreaterThanOrEqual(1);
  });

  it('renders accessible static fallback with image and interface when prefers-reduced-motion is enabled', () => {
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

    const { container } = render(
      <MetaGlassesPortalHero onGetStarted={vi.fn()} onSignIn={vi.fn()} />
    );
    expect(container.querySelector('[data-reduced-motion="true"]')).toBeInTheDocument();
    expect(screen.getByAltText(/Ray-Ban Meta smart glasses secured by Sentinel/i)).toBeInTheDocument();
    expect(screen.getByTestId('lens-interface-view')).toBeInTheDocument();
  });
});
