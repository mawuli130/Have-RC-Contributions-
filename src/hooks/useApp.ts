import { useCallback, useMemo, useState } from 'react';

export interface Toast {
  id: string;
  tone: 'success' | 'error' | 'info';
  text: string;
}

let counter = 0;
function nextId() {
  counter += 1;
  return `toast_${counter}_${Date.now()}`;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: Toast['tone'], text: string) => {
      const id = nextId();
      setToasts((prev) => [...prev, { id, tone, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  return useMemo(
    () => ({
      toasts,
      dismiss,
      success: (text: string) => push('success', text),
      error: (text: string) => push('error', text),
      info: (text: string) => push('info', text),
    }),
    [toasts, dismiss, push]
  );
}

export function useFormState<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);
  const reset = useCallback(() => setValues(initial), [initial]);
  return { values, set, reset, setValues };
}
