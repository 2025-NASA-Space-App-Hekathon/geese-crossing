// Centralized debug flag handling.
// Enable by setting NEXT_PUBLIC_DEBUG=true in env.
export const isDebug = (): boolean => {
    if (typeof window !== 'undefined') {
        // Allow manual override at runtime: window.__GLOBE_DEBUG__ = true/false
        // Do NOT force-enable it automatically to avoid perf cost in prod.
        if ((window as any).__GLOBE_DEBUG__ !== undefined) return !!(window as any).__GLOBE_DEBUG__;
    }
    return process.env.NEXT_PUBLIC_DEBUG === 'true';
};

export const setRuntimeDebug = (v: boolean) => {
    if (typeof window !== 'undefined') (window as any).__GLOBE_DEBUG__ = v;
};

export const dlog = (...args: any[]) => { if (isDebug()) console.log('[DEBUG]', ...args); };