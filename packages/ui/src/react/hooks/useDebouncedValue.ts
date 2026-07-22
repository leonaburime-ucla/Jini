// Trailing-debounce a fast-changing value (e.g. a search box) before it
// drives an expensive downstream effect (a network fetch). Not tied to any
// one feature domain — feature-local hooks live inside their own
// `features/<domain>/react/hooks/` instead.
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
