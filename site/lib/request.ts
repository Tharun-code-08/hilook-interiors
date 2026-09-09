/** Anything that can report request headers — NextRequest, or the Headers a
 *  server component gets from next/headers. */
type HeaderSource =
  { headers: { get(name: string): string | null } } | { get(name: string): string | null };

/**
 * Resolves a header reader from either shape.
 *
 * Checks for a callable `get` FIRST rather than discriminating on the presence
 * of a `headers` property. Next's ReadonlyHeaders (what a server component
 * gets from next/headers) carries its own internal `headers` field, so an
 * `"headers" in source` test passes for it and then reads the wrong object —
 * which type-checked fine and threw at runtime.
 */
function headerGetter(source: HeaderSource): (name: string) => string | null {
  if (typeof (source as { get?: unknown }).get === "function") {
    const self = source as { get(name: string): string | null };
    return (name) => self.get(name);
  }

  const wrapper = source as { headers: { get(name: string): string | null } };
  return (name) => wrapper.headers.get(name);
}

/**
 * Client IP resolution for rate limiting.
 *
 * The previous login limiter keyed on `x-forwarded-for.split(",")[0]` — the
 * left-most entry, which is the one value in the chain the *client* writes.
 * Anyone could send `X-Forwarded-For: <random>` and get a fresh bucket on
 * every request, so the lockout counted for nothing.
 *
 * X-Forwarded-For is append-only left-to-right: each proxy appends the address
 * it received the connection from. So with N trusted proxies in front of us,
 * the trustworthy client address is the Nth entry from the right. Everything
 * to the left of that is client-supplied and must be ignored.
 *
 * Configure with TRUSTED_PROXY_HOPS (see .env.example):
 *   0 → no proxy; ignore the header entirely
 *   1 → one CDN/reverse proxy (Vercel, Cloudflare, nginx) — the default
 */
export function clientIp(source: HeaderSource): string {
  const get = headerGetter(source);
  const hops = trustedProxyHops();

  if (hops > 0) {
    const forwarded = get("x-forwarded-for");
    if (forwarded) {
      const chain = forwarded
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      // Nth from the right. If the chain is shorter than configured, the
      // left-most entry is the furthest back we can go.
      const index = chain.length - hops;
      const candidate = chain[index >= 0 ? index : 0];
      if (candidate && isPlausibleIp(candidate)) return normalise(candidate);
    }

    // Some platforms send a single-value header instead.
    const real = get("x-real-ip");
    if (real && isPlausibleIp(real.trim())) return normalise(real.trim());
  }

  return "unknown";
}

function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw === undefined) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 1;
  return parsed;
}

/**
 * Cheap shape check. This is not validation for storage — it only stops
 * junk from becoming a rate-limit bucket key, and caps length so a long
 * header value cannot bloat the store.
 */
function isPlausibleIp(value: string): boolean {
  if (value.length === 0 || value.length > 45) return false;
  return /^[0-9a-fA-F:.]+$/.test(value);
}

/** IPv6 is case-insensitive; fold it so one client is one bucket. */
function normalise(value: string): string {
  return value.toLowerCase();
}
