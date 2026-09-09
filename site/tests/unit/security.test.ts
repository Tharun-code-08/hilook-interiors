import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { CSRF_COOKIE, CSRF_HEADER, generateCsrfToken, requiresCsrf, verifyCsrf } from "@/lib/csrf";
import { clientIp } from "@/lib/request";
import { isSafeStorageKey, contentTypeFromKey } from "@/lib/storage";

/** Minimal stand-in for the parts of NextRequest these functions read. */
function fakeRequest(cookies: Record<string, string>, headers: Record<string, string>) {
  return {
    cookies: { get: (n: string) => (n in cookies ? { value: cookies[n] } : undefined) },
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  };
}

describe("CSRF double-submit", () => {
  it("accepts a matching cookie and header", () => {
    const token = generateCsrfToken();
    const req = fakeRequest({ [CSRF_COOKIE]: token }, { [CSRF_HEADER]: token });
    expect(verifyCsrf(req)).toBe(true);
  });

  it("rejects a missing header — the case an attacker on another origin is in", () => {
    // A cross-site form POST sends the cookie but cannot read it to echo back.
    const token = generateCsrfToken();
    expect(verifyCsrf(fakeRequest({ [CSRF_COOKIE]: token }, {}))).toBe(false);
  });

  it("rejects a mismatched header", () => {
    const req = fakeRequest(
      { [CSRF_COOKIE]: generateCsrfToken() },
      { [CSRF_HEADER]: generateCsrfToken() }
    );
    expect(verifyCsrf(req)).toBe(false);
  });

  it("rejects a missing cookie", () => {
    expect(verifyCsrf(fakeRequest({}, { [CSRF_HEADER]: generateCsrfToken() }))).toBe(false);
  });

  it("rejects a short token even if it matches, so a blank value can't pass", () => {
    const req = fakeRequest({ [CSRF_COOKIE]: "abc" }, { [CSRF_HEADER]: "abc" });
    expect(verifyCsrf(req)).toBe(false);
  });

  it("generates url-safe tokens of usable length", () => {
    const token = generateCsrfToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateCsrfToken()).not.toBe(token);
  });

  it("guards state-changing methods only", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE", "delete"]) {
      expect(requiresCsrf(m), m).toBe(true);
    }
    for (const m of ["GET", "HEAD", "OPTIONS"]) {
      expect(requiresCsrf(m), m).toBe(false);
    }
  });
});

describe("client IP resolution", () => {
  const original = process.env.TRUSTED_PROXY_HOPS;
  beforeEach(() => {
    process.env.TRUSTED_PROXY_HOPS = "1";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = original;
  });

  /**
   * The original limiter took the LEFT-most x-forwarded-for entry, which is
   * the one value the client writes. Anyone could send a random value and get
   * a fresh rate-limit bucket per request, so the login lockout counted for
   * nothing. With one trusted proxy the real address is the last entry.
   */
  it("takes the entry the trusted proxy appended, not the client-supplied one", () => {
    const req = fakeRequest({}, { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
    expect(clientIp(req)).toBe("3.3.3.3");
  });

  it("a forged left-most entry cannot change the bucket", () => {
    const real = "9.9.9.9";
    const a = clientIp(fakeRequest({}, { "x-forwarded-for": `1.2.3.4, ${real}` }));
    const b = clientIp(fakeRequest({}, { "x-forwarded-for": `5.6.7.8, ${real}` }));
    expect(a).toBe(b);
  });

  it("honours a deeper proxy chain", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const req = fakeRequest({}, { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
    expect(clientIp(req)).toBe("2.2.2.2");
  });

  it("ignores the header entirely when no proxy is configured", () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    expect(clientIp(fakeRequest({}, { "x-forwarded-for": "1.1.1.1" }))).toBe("unknown");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(fakeRequest({}, { "x-real-ip": "4.4.4.4" }))).toBe("4.4.4.4");
  });

  it("rejects junk that would otherwise become an unbounded bucket key", () => {
    expect(clientIp(fakeRequest({}, { "x-forwarded-for": "<script>alert(1)</script>" }))).toBe(
      "unknown"
    );
    expect(clientIp(fakeRequest({}, { "x-forwarded-for": "x".repeat(500) }))).toBe("unknown");
  });

  it("folds IPv6 case so one client is one bucket", () => {
    const upper = clientIp(fakeRequest({}, { "x-real-ip": "2001:DB8::1" }));
    const lower = clientIp(fakeRequest({}, { "x-real-ip": "2001:db8::1" }));
    expect(upper).toBe(lower);
  });

  /** A server component passes the Headers object itself, not a request. */
  it("accepts a bare Headers-like object", () => {
    const headers = new Headers({ "x-real-ip": "8.8.8.8" });
    expect(clientIp(headers)).toBe("8.8.8.8");
  });
});

describe("storage key safety", () => {
  it("accepts the keys we generate", () => {
    expect(isSafeStorageKey("V1StGXR8Z5jdHi6BmyT.jpg")).toBe(true);
    expect(isSafeStorageKey("abc-123_XYZ.webp")).toBe(true);
  });

  it("rejects traversal and separators", () => {
    // These round trip through the database and a URL segment before reaching
    // the filesystem, so they are re-validated rather than trusted.
    for (const key of [
      "../../etc/passwd",
      "..%2Fsecret.jpg",
      "sub/dir.jpg",
      "sub\\dir.jpg",
      "/absolute.jpg",
      "no-extension",
      "",
      "x".repeat(200) + ".jpg",
    ]) {
      expect(isSafeStorageKey(key), `${key} should be rejected`).toBe(false);
    }
  });

  it("maps extensions to image types and nothing else", () => {
    expect(contentTypeFromKey("a.jpg")).toBe("image/jpeg");
    expect(contentTypeFromKey("a.webp")).toBe("image/webp");
    // Anything unexpected must not be served as something the browser executes.
    expect(contentTypeFromKey("a.html")).toBe("application/octet-stream");
    expect(contentTypeFromKey("a.svg")).toBe("application/octet-stream");
  });
});
