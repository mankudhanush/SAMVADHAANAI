/**
 * Performance utilities for LegalWise
 * - Debouncing hooks
 * - Request caching
 * - Virtualization helpers
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════
   DEBOUNCE HOOKS
   ═══════════════════════════════════════════════════════════ */

/**
 * Debounce a value - delays updating until after wait ms of no changes
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced callback - prevents rapid function calls
 */
export function useDebouncedCallback(callback, delay = 300, deps = []) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedFn = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay, ...deps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

/**
 * Throttle callback - ensures function is called at most once per interval
 */
export function useThrottledCallback(callback, interval = 300, deps = []) {
  const lastRun = useRef(0);
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledFn = useCallback((...args) => {
    const now = Date.now();

    if (now - lastRun.current >= interval) {
      lastRun.current = now;
      callbackRef.current(...args);
    } else {
      // Schedule trailing call
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        lastRun.current = Date.now();
        callbackRef.current(...args);
      }, interval - (now - lastRun.current));
    }
  }, [interval, ...deps]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return throttledFn;
}

/* ═══════════════════════════════════════════════════════════
   REQUEST CACHING
   ═══════════════════════════════════════════════════════════ */

const requestCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Simple cache for API responses (safe for read-only operations)
 */
export function getCachedResponse(key) {
  const cached = requestCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    requestCache.delete(key);
    return null;
  }

  return cached.data;
}

export function setCachedResponse(key, data) {
  requestCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function clearCache(keyPattern = null) {
  if (keyPattern) {
    for (const key of requestCache.keys()) {
      if (key.includes(keyPattern)) {
        requestCache.delete(key);
      }
    }
  } else {
    requestCache.clear();
  }
}

/* ═══════════════════════════════════════════════════════════
   VIRTUALIZATION HELPER
   ═══════════════════════════════════════════════════════════ */

/**
 * Simple windowing hook for rendering only visible items
 */
export function useVirtualizedList(items, itemHeight = 150, containerHeight = 600) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + 2
    );
    return { startIndex, endIndex };
  }, [scrollTop, items.length, itemHeight, containerHeight]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex).map((item, i) => ({
      item,
      index: visibleRange.startIndex + i,
      style: {
        position: 'absolute',
        top: (visibleRange.startIndex + i) * itemHeight,
        left: 0,
        right: 0,
        height: itemHeight,
      },
    }));
  }, [items, visibleRange, itemHeight]);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    containerProps: {
      onScroll: handleScroll,
      style: { overflow: 'auto', height: containerHeight, position: 'relative' },
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   INTERSECTION OBSERVER HOOK (Lazy Loading)
   ═══════════════════════════════════════════════════════════ */

/**
 * Detect when element enters viewport for lazy loading
 */
export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
        ...options,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);

  return { elementRef, isIntersecting, hasIntersected };
}

/* ═══════════════════════════════════════════════════════════
   STABLE CALLBACK REF
   ═══════════════════════════════════════════════════════════ */

/**
 * Returns a stable function reference that always calls the latest callback
 */
export function useStableCallback(callback) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args) => {
    return callbackRef.current?.(...args);
  }, []);
}

/* ═══════════════════════════════════════════════════════════
   PREVIOUS VALUE HOOK
   ═══════════════════════════════════════════════════════════ */

export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

/* ═══════════════════════════════════════════════════════════
   REQUEST DEDUPLICATION
   ═══════════════════════════════════════════════════════════ */

const pendingRequests = new Map();

/**
 * Deduplicate identical requests in flight
 */
export async function deduplicatedRequest(key, requestFn) {
  // If request is already in flight, return the existing promise
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // Create the request promise
  const requestPromise = requestFn()
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, requestPromise);
  return requestPromise;
}
