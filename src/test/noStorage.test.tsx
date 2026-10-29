import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/** Sandboxed iframes (the in-app preview) deny localStorage; the app must still work. */
describe('Runs without localStorage (sandboxed iframe)', () => {
  it('renders the welcome screen when storage access throws', async () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    vi.resetModules();
    const { default: App } = await import('../App');
    render(<App />);
    expect(screen.getByTestId('welcome-join')).toBeInTheDocument();
    expect(screen.getByText(/Join the Group/)).toBeInTheDocument();
    spy.mockRestore();
  });
});
