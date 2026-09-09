import { describe, expect, it } from "vitest";
import {
  awardUpdateSchema,
  contactSchema,
  loginSchema,
  passwordChangeSchema,
  portfolioCreateSchema,
  portfolioUpdateSchema,
  processUpdateSchema,
  reviewUpdateSchema,
  sectionViewSchema,
  serviceUpdateSchema,
  settingsUpdateSchema,
  userCreateSchema,
} from "@/lib/validation";

/**
 * The update-schema tests below guard a bug that shipped and silently
 * destroyed data.
 *
 * The update schemas were originally `createSchema.partial()`. That looks
 * correct, but `.partial()` only makes a key optional — a `.default()` on that
 * key still fires when the key is absent. So a PUT carrying just `{ title }`
 * parsed into `{ title, category: "Residential", description: "", images: [] }`
 * and the repository wrote every one of those over the stored values.
 *
 * Renaming a project erased its description, its category, and its whole image
 * list. Same for services, reviews, process steps and awards.
 *
 * The invariant these lock in: parsing a partial update must return ONLY the
 * keys the client actually sent.
 */
describe("update schemas never inject defaults", () => {
  it("portfolio: a title-only update touches nothing else", () => {
    const parsed = portfolioUpdateSchema.parse({ title: "Renamed" });

    expect(parsed).toEqual({ title: "Renamed" });
    expect(Object.keys(parsed)).toEqual(["title"]);
    // The specific fields the old bug wiped.
    expect(parsed).not.toHaveProperty("category");
    expect(parsed).not.toHaveProperty("description");
    expect(parsed).not.toHaveProperty("images");
  });

  it("service: a name-only update leaves description and image alone", () => {
    const parsed = serviceUpdateSchema.parse({ name: "Renamed" });
    expect(Object.keys(parsed)).toEqual(["name"]);
  });

  it("review: an approval toggle doesn't reset rating or text", () => {
    const parsed = reviewUpdateSchema.parse({ approved: true });
    expect(Object.keys(parsed)).toEqual(["approved"]);
    expect(parsed).not.toHaveProperty("rating");
  });

  it("process step: a title-only update leaves the body alone", () => {
    const parsed = processUpdateSchema.parse({ title: "Renamed" });
    expect(Object.keys(parsed)).toEqual(["title"]);
  });

  it("award: a title-only update leaves kind, detail and url alone", () => {
    const parsed = awardUpdateSchema.parse({ title: "Renamed" });
    expect(Object.keys(parsed)).toEqual(["title"]);
  });

  it("an empty update yields an empty patch, not a full reset", () => {
    expect(portfolioUpdateSchema.parse({})).toEqual({});
    expect(serviceUpdateSchema.parse({})).toEqual({});
    expect(reviewUpdateSchema.parse({})).toEqual({});
  });
});

describe("create schemas DO apply defaults", () => {
  it("fills category, description and images when omitted", () => {
    const parsed = portfolioCreateSchema.parse({ title: "New Project" });
    expect(parsed).toEqual({
      title: "New Project",
      category: "Residential",
      description: "",
      images: [],
    });
  });
});

describe("safeUrl", () => {
  it("accepts http(s) and site-relative paths", () => {
    for (const url of ["https://example.com/a.jpg", "http://example.com", "/uploads/x.png", ""]) {
      expect(() => portfolioCreateSchema.parse({ title: "t", images: [url] })).not.toThrow();
    }
  });

  it("rejects javascript: and protocol-relative URLs", () => {
    // Both would otherwise end up in an href or an <img src> on the public site.
    for (const url of ["javascript:alert(1)", "//evil.example.com/x.jpg", "data:text/html,x"]) {
      const result = portfolioCreateSchema.safeParse({ title: "t", images: [url] });
      expect(result.success, `${url} should be rejected`).toBe(false);
    }
  });
});

describe("settings", () => {
  it("rejects a malformed Google Analytics id", () => {
    // This value is interpolated into an inline <script>.
    expect(settingsUpdateSchema.safeParse({ googleAnalyticsId: "'; alert(1); //" }).success).toBe(
      false
    );
  });

  it("accepts a well-formed one, and empty to disable", () => {
    expect(settingsUpdateSchema.safeParse({ googleAnalyticsId: "G-ABC123XYZ" }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ googleAnalyticsId: "" }).success).toBe(true);
  });

  it("rejects a javascript: social URL", () => {
    expect(settingsUpdateSchema.safeParse({ instagramUrl: "javascript:alert(1)" }).success).toBe(
      false
    );
  });
});

describe("section beacon allowlist", () => {
  it("accepts known sections", () => {
    expect(sectionViewSchema.safeParse({ section: "contact" }).success).toBe(true);
  });

  it("rejects invented names, which would grow the key space without bound", () => {
    expect(sectionViewSchema.safeParse({ section: "made-up-" + Date.now() }).success).toBe(false);
  });
});

describe("contact", () => {
  it("requires a real email", () => {
    const base = { name: "A", message: "Hello there" };
    expect(contactSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, email: "a@b.co" }).success).toBe(true);
  });

  it("bounds the message so one submission can't be unbounded", () => {
    const long = "x".repeat(4001);
    expect(contactSchema.safeParse({ name: "A", email: "a@b.co", message: long }).success).toBe(
      false
    );
  });

  it("carries the honeypot and timing fields through", () => {
    const parsed = contactSchema.parse({
      name: "A",
      email: "a@b.co",
      message: "Hello",
      website: "filled-by-a-bot",
      startedAt: 1_700_000_000_000,
    });
    expect(parsed.website).toBe("filled-by-a-bot");
    expect(parsed.startedAt).toBe(1_700_000_000_000);
  });
});

describe("credentials", () => {
  it("requires at least 12 characters for a new password", () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: "x", newPassword: "short" }).success
    ).toBe(false);
    expect(
      passwordChangeSchema.safeParse({
        currentPassword: "old-password-here",
        newPassword: "a-long-enough-passphrase",
      }).success
    ).toBe(true);
  });

  it("rejects reusing the current password", () => {
    const same = "a-long-enough-passphrase";
    expect(
      passwordChangeSchema.safeParse({ currentPassword: same, newPassword: same }).success
    ).toBe(false);
  });

  it("defaults a new account to editor, not owner", () => {
    // The pre-P1 route defaulted to owner, which handed full account control
    // to anyone created without an explicit role.
    const parsed = userCreateSchema.parse({
      username: "someone",
      password: "a-long-enough-passphrase",
    });
    expect(parsed.role).toBe("editor");
  });

  it("rejects usernames with characters that aren't safe to display", () => {
    expect(
      userCreateSchema.safeParse({ username: "a b/c", password: "a-long-enough-passphrase" })
        .success
    ).toBe(false);
  });

  it("trims but does not bound the login password below the stored hash limit", () => {
    expect(loginSchema.safeParse({ username: "  admin  ", password: "x" }).success).toBe(true);
    expect(loginSchema.parse({ username: "  admin  ", password: "x" }).username).toBe("admin");
  });
});
