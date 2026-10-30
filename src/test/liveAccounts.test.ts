import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLiveSupabaseConfigured, supabase } from '../services/supabaseClient';
import {
  liveApproveMember,
  liveGetSessionUser,
  liveListMembers,
  liveSignIn,
  liveSignUp,
} from '../services/liveAuth';

const migration = (name: string) =>
  readFileSync(join(process.cwd(), 'supabase', 'migrations', name), 'utf8');

describe('Live Supabase accounts', () => {
  it('stays in offline mode when no environment variables are set', () => {
    expect(isLiveSupabaseConfigured).toBe(false);
    expect(supabase).toBeNull();
  });

  it('refuses to create accounts against an unconfigured backend', async () => {
    await expect(
      liveSignUp({
        fullName: 'Test Person',
        email: 'test@example.com',
        password: 'StrongPass123',
        acceptedPrivacy: true,
      })
    ).rejects.toThrow(/Supabase is not configured/i);
    await expect(liveSignIn('test@example.com', 'StrongPass123')).rejects.toThrow(
      /Supabase is not configured/i
    );
    await expect(liveApproveMember('some-user-id')).rejects.toThrow(/Supabase is not configured/i);
    await expect(liveListMembers()).rejects.toThrow(/Supabase is not configured/i);
  });

  it('restores no session when offline', async () => {
    await expect(liveGetSessionUser()).resolves.toBeNull();
  });

  it('validates signup input before touching the network', async () => {
    // Validation errors must win over the not-configured error path ordering:
    // short passwords are rejected with the same message as offline mode once
    // configured, so here we only assert a friendly error is thrown.
    await expect(
      liveSignUp({
        fullName: 'Te',
        email: 'bad-email',
        password: 'short',
        acceptedPrivacy: false,
      })
    ).rejects.toThrow(/full name/i);
  });
});

describe('Account migrations', () => {
  it('003 creates the profile trigger and guarded admin RPCs', () => {
    const sql = migration('003_live_accounts.sql');
    expect(sql).toContain('handle_new_user');
    expect(sql).toContain('AFTER INSERT ON auth.users');
    expect(sql).toContain("'pending'");
    expect(sql).toContain('admin_set_membership');
    expect(sql).toContain('admin_set_role');
    expect(sql).toContain('has_admin_or_treasurer_role');
    // The trigger function must never be callable from the app.
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated');
    // The last administrator can never be removed.
    expect(sql).toContain('last administrator');
  });

  it('001 can be re-run without "policy already exists" errors', () => {
    const sql = migration('001_initial_schema.sql');
    const drops = sql.match(/DROP POLICY IF EXISTS/g) ?? [];
    const creates = sql.match(/CREATE POLICY/g) ?? [];
    expect(creates.length).toBeGreaterThanOrEqual(32);
    expect(drops.length).toBe(creates.length);
  });

  it('001 keeps the locked-down first-admin bootstrap', () => {
    const sql = migration('001_initial_schema.sql');
    expect(sql).toContain('bootstrap_first_admin');
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.bootstrap_first_admin(TEXT) FROM PUBLIC, anon, authenticated'
    );
  });
});
