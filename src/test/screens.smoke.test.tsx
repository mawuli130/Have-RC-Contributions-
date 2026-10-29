import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { signIn } from '../services/databaseService';
import { invalidateCache, resetToSeed } from '../services/localStore';

beforeEach(() => { resetToSeed(); invalidateCache(); });

/** Renders every primary screen with an admin session to catch runtime crashes. */
describe('All primary screens render', () => {
  const screens: Array<[string, string]> = [
    ['home', 'Recorded group balance'],
    ['contributions', 'My Contributions'],
    ['fund', 'Group Fund'],
    ['members', 'Members'],
    ['more', 'My account'],
  ];

  screens.forEach(([tab, marker]) => {
    it(`renders the ${tab} tab`, async () => {
      const user = userEvent.setup();
      signIn('admin@have2022.org', 'Admin123!');
      render(<App />);
      await user.click(screen.getByTestId(`tab-${tab}`));
      await waitFor(() => expect(screen.getAllByText(new RegExp(marker, 'i')).length).toBeGreaterThan(0));
    });
  });

  const adminScreens: Array<[string, string]> = [
    ['admin-dashboard', 'Admin Portal'],
    ['admin-members', 'Manage Members'],
    ['admin-contribution-settings', 'Contribution Settings'],
    ['admin-review-payments', 'Review Payments'],
    ['admin-outstanding', 'Outstanding Members'],
    ['admin-add-expense', 'Add Expense'],
    ['admin-expense-history', 'Expense History'],
    ['admin-reports', 'Financial Reports'],
    ['admin-audit-log', 'Admin Activity Log'],
  ];

  adminScreens.forEach(([screenName, marker]) => {
    it(`renders ${screenName}`, async () => {
      const user = userEvent.setup();
      signIn('admin@have2022.org', 'Admin123!');
      render(<App />);
      await user.click(screen.getByTestId('tab-more'));
      await user.click(await screen.findByTestId(`admin-menu-${screenName}`));
      await waitFor(() => expect(screen.getAllByText(new RegExp(marker, 'i')).length).toBeGreaterThan(0));
    });
  });

  const memberScreens: Array<[string, string, string]> = [
    ['payment-history', 'My payment history', 'member'],
    ['financial-history', 'Financial history', 'member'],
    ['notifications', 'Notifications', 'member'],
    ['profile-edit', 'My profile', 'member'],
    ['privacy', 'Privacy notice', 'member'],
  ];

  memberScreens.forEach(([screenName, marker, who]) => {
    it(`renders ${screenName}`, async () => {
      const user = userEvent.setup();
      signIn(who === 'member' ? 'ama@example.com' : 'admin@have2022.org', 'Member123!');
      render(<App />);
      await user.click(screen.getByTestId('tab-more'));
      await user.click(await screen.findByTestId(`more-nav-${screenName}`));
      await waitFor(() => expect(screen.getAllByText(new RegExp(marker, 'i')).length).toBeGreaterThan(0));
    });
  });
});
