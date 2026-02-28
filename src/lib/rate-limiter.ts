/**
 * Sliding-window in-process rate limiter.
 * Default: 20 requests per 60 seconds per key (userId).
 */

interface Window {
    count: number;
    windowStart: number;
}

const windows = new Map<string, Window>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 20;

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = windows.get(key);

    if (!entry || now - entry.windowStart >= WINDOW_MS) {
        windows.set(key, { count: 1, windowStart: now });
        return { allowed: true, retryAfterMs: 0 };
    }

    if (entry.count >= MAX_REQUESTS) {
        const retryAfterMs = WINDOW_MS - (now - entry.windowStart);
        return { allowed: false, retryAfterMs };
    }

    entry.count++;
    return { allowed: true, retryAfterMs: 0 };
}
