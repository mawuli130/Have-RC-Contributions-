import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OfflineBanner } from '../components/OfflineBanner';
import { InstallAppButton } from '../components/InstallAppButton';

const pub = (name: string) => join(process.cwd(), 'public', name);
const read = (path: string) => readFileSync(path, 'utf8');

describe('PWA installability', () => {
  it('manifest declares a standalone app with the school crest icons', () => {
    const manifest = JSON.parse(read(pub('manifest.webmanifest')));
    expect(manifest.name).toContain('Have R/C JHS 2022');
    expect(manifest.short_name).toBe('Have R/C 2022');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.theme_color).toBe('#0B3570');

    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
    expect(purposes).toContain('maskable');
  });

  it('every manifest icon exists on disk as a real PNG', () => {
    const manifest = JSON.parse(read(pub('manifest.webmanifest')));
    for (const icon of manifest.icons as Array<{ src: string }>) {
      const path = pub(icon.src.replace(/^\//, ''));
      expect(existsSync(path), icon.src).toBe(true);
      const bytes = readFileSync(path);
      // PNG magic number
      expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(bytes.length).toBeGreaterThan(2000);
    }
    expect(existsSync(pub('icons/crest.svg'))).toBe(true);
    expect(existsSync(pub('icons/apple-touch-icon.png'))).toBe(true);
  });

  it('index.html links the manifest, crest favicon and Apple icon', () => {
    const html = read(join(process.cwd(), 'index.html'));
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('manifest.webmanifest');
    expect(html).toContain('/icons/crest.svg');
    expect(html).toContain('apple-touch-icon');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('#0B3570');
  });

  it('service worker caches the shell and never intercepts API traffic', () => {
    const sw = read(pub('sw.js'));
    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain("addEventListener('fetch'");
    expect(sw).toContain("request.mode === 'navigate'");
    expect(sw).toContain('url.origin !== self.location.origin');
    expect(sw).toContain('clients.claim()');
    expect(sw).toContain("addEventListener('push'");
    expect(sw).toContain("addEventListener('notificationclick'");
    expect(sw).toContain("'v2'");
    expect(sw).toContain('/manifest.webmanifest');
    expect(sw).toContain('/icons/icon-512.png');
  });

  it('icon generator script is wired up', () => {
    const pkg = JSON.parse(read(join(process.cwd(), 'package.json')));
    expect(pkg.scripts.icons).toContain('generate-icons');
    expect(existsSync(join(process.cwd(), 'scripts', 'generate-icons.mjs'))).toBe(true);
  });
});

describe('Offline experience', () => {
  it('banner appears when offline and confirms when back online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByText(/You're offline/)).toBeNull();

    fireEvent(window, new Event('offline'));
    expect(screen.getByText(/You're offline · Showing last saved data/)).toBeTruthy();

    fireEvent(window, new Event('online'));
    expect(screen.getByText(/Back online · Updating…/)).toBeTruthy();
  });

  it('install button explains the manual route when no prompt is available', () => {
    render(<InstallAppButton variant="row" />);
    fireEvent.click(screen.getByTestId('install-app-button'));
    expect(screen.getByText(/Add to Home screen/)).toBeTruthy();
  });
});
