import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* Executes public/sw.js in a fake worker scope so we can simulate
 * browsers like older iOS Safari that have NO Cache API (`caches`
 * undefined) — the exact environment that bricked the site with v2. */

type Handler = (event: Record<string, unknown>) => void;

function loadServiceWorker(fetchImpl: unknown) {
  const handlers: Record<string, Handler[]> = {};
  const mockSelf = {
    addEventListener: (type: string, fn: Handler) => {
      (handlers[type] ??= []).push(fn);
    },
    skipWaiting: vi.fn(() => Promise.resolve()),
    clients: {
      claim: vi.fn(() => Promise.resolve()),
      matchAll: vi.fn(() => Promise.resolve([])),
      openWindow: vi.fn(),
    },
    registration: { showNotification: vi.fn(() => Promise.resolve()) },
    location: { origin: 'https://app.example' },
  };
  const code = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');
  const run = new Function('self', 'fetch', 'Response', code);
  run(mockSelf, fetchImpl, Response);
  return { handlers, mockSelf };
}

function lifecycleEvent() {
  let promise: Promise<unknown> | undefined;
  return {
    event: {
      waitUntil: (p: Promise<unknown>) => {
        promise = p;
      },
    },
    settled: () => promise,
  };
}

function fetchEvent(url: string, mode = 'navigate') {
  const respondWith = vi.fn();
  return {
    event: {
      request: { method: 'GET', url, mode },
      respondWith,
    },
    respondWith,
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).caches;
});

describe('Service worker safety', () => {
  it('without the Cache API (older iOS Safari) it steps aside and never breaks a page load', async () => {
    expect(typeof (globalThis as Record<string, unknown>).caches).toBe('undefined');
    const offlineFetch = () => Promise.reject(new Error('offline'));
    const { handlers, mockSelf } = loadServiceWorker(offlineFetch);

    // Install must succeed even with no caches available.
    const install = lifecycleEvent();
    handlers.install[0](install.event);
    await install.settled();
    expect(mockSelf.skipWaiting).toHaveBeenCalled();

    // Activate likewise.
    const activate = lifecycleEvent();
    handlers.activate[0](activate.event);
    await activate.settled();
    expect(mockSelf.clients.claim).toHaveBeenCalled();

    // A navigation must NOT be intercepted — the browser default applies.
    const nav = fetchEvent('https://app.example/');
    handlers.fetch[0](nav.event);
    expect(nav.respondWith).not.toHaveBeenCalled();
  });

  it('with caches but offline, navigations resolve to a real page (never an error)', async () => {
    (globalThis as Record<string, unknown>).caches = {
      open: vi.fn(() =>
        Promise.resolve({ addAll: vi.fn(() => Promise.resolve()), put: vi.fn(() => Promise.resolve()) })
      ),
      keys: vi.fn(() => Promise.resolve([])),
      delete: vi.fn(() => Promise.resolve(true)),
      match: vi.fn(() => Promise.resolve(undefined)),
    };
    const { handlers } = loadServiceWorker(() => Promise.reject(new Error('offline')));

    const nav = fetchEvent('https://app.example/');
    handlers.fetch[0](nav.event);
    expect(nav.respondWith).toHaveBeenCalledTimes(1);
    const response = (await nav.respondWith.mock.calls[0][0]) as Response;
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("You're offline");
  });

  it('with caches, a cached app shell is served when the network is down', async () => {
    (globalThis as Record<string, unknown>).caches = {
      open: vi.fn(() =>
        Promise.resolve({ addAll: vi.fn(() => Promise.resolve()), put: vi.fn(() => Promise.resolve()) })
      ),
      keys: vi.fn(() => Promise.resolve([])),
      delete: vi.fn(() => Promise.resolve(true)),
      match: vi.fn(() => Promise.resolve(new Response('APP SHELL', { status: 200 }))),
    };
    const { handlers } = loadServiceWorker(() => Promise.reject(new Error('offline')));

    const nav = fetchEvent('https://app.example/');
    handlers.fetch[0](nav.event);
    const response = (await nav.respondWith.mock.calls[0][0]) as Response;
    await expect(response.text()).resolves.toBe('APP SHELL');
  });

  it('cross-origin (Supabase) requests are never intercepted', async () => {
    (globalThis as Record<string, unknown>).caches = {
      open: vi.fn(() => Promise.resolve({ addAll: vi.fn(), put: vi.fn() })),
      keys: vi.fn(() => Promise.resolve([])),
      delete: vi.fn(() => Promise.resolve(true)),
      match: vi.fn(() => Promise.resolve(undefined)),
    };
    const { handlers } = loadServiceWorker(() => Promise.resolve(new Response('ok')));
    const api = fetchEvent('https://yyrtfnyyzjzouaplknck.supabase.co/rest/v1/profiles', 'cors');
    handlers.fetch[0](api.event);
    expect(api.respondWith).not.toHaveBeenCalled();
  });
});
