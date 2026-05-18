const DEFAULT_LIMITS = {
  global: { limit: 900, windowMs: 10 * 60_000 },
  registerIp: { limit: 6, windowMs: 60 * 60_000 },
  registerEmail: { limit: 3, windowMs: 60 * 60_000 },
  loginIp: { limit: 40, windowMs: 15 * 60_000 },
  loginEmail: { limit: 12, windowMs: 15 * 60_000 },
  projectCreateUser: { limit: 80, windowMs: 60 * 60_000 },
  shareCreateUser: { limit: 60, windowMs: 60 * 60_000 },
  patchUser: { limit: 360, windowMs: 60 * 60_000 },
  sharePatchToken: { limit: 240, windowMs: 60 * 60_000 },
  errorReportIp: { limit: 5, windowMs: 60 * 60_000 },
  errorReportFingerprint: { limit: 2, windowMs: 24 * 60 * 60_000 },
  errorReportUser: { limit: 10, windowMs: 60 * 60_000 },
};

export function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return String(cf).split(",")[0].trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export class AbuseGuard {
  constructor(limits = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.buckets = new Map();
  }

  check(name, key, opts = {}) {
    const limit = opts.limit ?? this.limits[name]?.limit;
    const windowMs = opts.windowMs ?? this.limits[name]?.windowMs;
    if (!limit || !windowMs || !key) return;
    const now = Date.now();
    const bucketKey = `${name}:${key}`;
    let bucket = this.buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(bucketKey, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      const err = new Error("Too many requests. Please wait a bit and try again.");
      err.statusCode = 429;
      err.retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      throw err;
    }
  }

  sweep() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
