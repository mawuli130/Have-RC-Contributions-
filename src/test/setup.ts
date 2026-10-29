import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { invalidateCache } from '../services/localStore';

beforeEach(() => {
  window.localStorage.clear();
  invalidateCache();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  invalidateCache();
});

// jsdom does not implement scrolling; stub it so component navigation stays quiet.
if (typeof window !== 'undefined') {
  window.scrollTo = () => undefined;
}
