function securityHeaders(_req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  next();
}

/**
 * In-memory limiter keyed by client IP. Fine for a single PM2 process;
 * counts reset when the server restarts.
 */
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  function entryFor(req) {
    const key = req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    return { key, entry, now };
  }

  return {
    /** Rejects the request if the IP already used up its attempts. */
    guard(req, res, next) {
      const { entry, now } = entryFor(req);
      if (entry.count >= max) {
        res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
        return res.status(429).json({ message });
      }
      next();
    },
    fail(req) {
      entryFor(req).entry.count += 1;
    },
    reset(req) {
      hits.delete(req.ip);
    },
  };
}

module.exports = { securityHeaders, createRateLimiter };
