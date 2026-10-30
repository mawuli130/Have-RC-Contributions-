import React from 'react';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import App from '../App';
import { signIn } from '../services/databaseService';
import { invalidateCache, resetToSeed } from '../services/localStore';

const VIEWPORTS = [
  { w: 360, h: 800 },
  { w: 375, h: 812 },
  { w: 393, h: 873 },
];

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
  window.dispatchEvent(new Event('resize'));
}

beforeEach(() => {
  resetToSeed();
  invalidateCache();
});

afterEach(() => {
  setViewport(1024, 768);
});

/**
 * Android viewport checks for the compact dashboard.
 * jsdom has no layout engine, so these assert the structure that
 * guarantees one-screen fit: fixed shell, max-3 list preview, 4 tiles,
 * 2 quick actions, and the fixed 5-tab bottom navigation.
 * (Visual pixel checks need a real browser — see docs/UI_REFERENCE.md.)
 */
describe('Android viewports — compact dashboard', () => {
  VIEWPORTS.forEach(({ w, h }) => {
    it(`home fits one screen at ${w}×${h}`, async () => {
      setViewport(w, h);
      signIn('ama@example.com', 'Member123!');
      const { container } = render(<App />);

      const home = await screen.findByTestId('home-screen');
      // Fixed-height, non-scrolling shell (height comes from .app-shell = 100dvh)
      expect(home.className).toContain('app-shell');
      expect(home.className).toContain('app-fixed');

      // Exactly the dashboard essentials — no long stacked sections
      expect(screen.getByText(/Good (morning|afternoon|evening), Ama/i)).toBeInTheDocument();
      expect(screen.getByText('Total Paid')).toBeInTheDocument();
      expect(screen.getByText('Outstanding')).toBeInTheDocument();
      expect(screen.getByText('Next Due Date')).toBeInTheDocument();
      expect(screen.getByText('Payment Status')).toBeInTheDocument();
      expect(screen.getByText('Recorded group balance')).toBeInTheDocument();
      expect(screen.queryByText(/Recent payments/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/How the balance/i)).not.toBeInTheDocument();

      // Quick actions always reachable
      expect(screen.getByTestId('home-submit-payment')).toBeInTheDocument();
      expect(screen.getByText('Payment History')).toBeInTheDocument();

      // Outstanding preview is capped — the full list lives in Members
      const rows = home.querySelectorAll('li');
      expect(rows.length).toBeLessThanOrEqual(3);

      // Fixed bottom navigation: 5 tabs, labels not truncated away
      const nav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(within(nav).getAllByRole('button')).toHaveLength(5);
      for (const label of ['Home', 'Contributions', 'Group Fund', 'Members', 'More']) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }

      // No element opts into horizontal scrolling at phone width
      expect(container.querySelectorAll('table')).toHaveLength(0);
      expect(w).toBeLessThanOrEqual(393);
      expect(h).toBeGreaterThanOrEqual(800);
    });
  });

  it('welcome uses the real photo asset and fits one screen', async () => {
    setViewport(360, 800);
    const { container } = render(<App />);
    const welcome = await screen.findByTestId('welcome-screen');
    expect(welcome.className).toContain('app-fixed');
    const img = container.querySelector('img[alt*="School building"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBeTruthy();
    expect(img?.className).toContain('object-cover');
    expect(screen.getByTestId('welcome-join')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-login')).toBeInTheDocument();
  });
});
