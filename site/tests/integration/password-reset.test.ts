import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";

const testDb = createTestDatabase();

type Ops = typeof import("@/lib/repos/operations");
type Resets = typeof import("@/lib/repos/password-resets");

let ops: Ops;
let resets: Resets;

beforeAll(async () => {
  await testDb.migrate();
  ops = await import("@/lib/repos/operations");
  resets = await import("@/lib/repos/password-resets");
});

afterAll(() => testDb.cleanup());

async function makeUser(username: string, email: string | null) {
  const created = await ops.createUser({
    username,
    password: "a-perfectly-long-password",
    role: "owner",
    email,
  });
  if (!created.ok) throw new Error(`could not create ${username}: ${created.reason}`);
  return created.user;
}

describe("finding an account to reset", () => {
  it("matches a username or an email address, ignoring case", async () => {
    const user = await makeUser("studio-owner", "Owner@Example.com");

    expect((await ops.findUserByIdentifier("STUDIO-OWNER"))?.id).toBe(user.id);
    expect((await ops.findUserByIdentifier("owner@example.COM"))?.id).toBe(user.id);
    expect(await ops.findUserByIdentifier("nobody@example.com")).toBeNull();
  });

  it("will not let two accounts share a recovery address", async () => {
    await makeUser("first-account", "shared@example.com");
    const second = await makeUser("second-account", null);

    expect(await ops.setUserEmail(second.id, "SHARED@example.com")).toEqual({
      ok: false,
      reason: "duplicate",
    });
    const clash = await ops.createUser({
      username: "third-account",
      password: "a-perfectly-long-password",
      role: "editor",
      email: "shared@example.com",
    });
    expect(clash).toEqual({ ok: false, reason: "duplicate-email" });
  });
});

describe("reset tokens", () => {
  it("work exactly once", async () => {
    const user = await makeUser("once-only", "once@example.com");
    const { token } = await resets.issueResetToken(user.id, "1.2.3.4");

    // Looking at a link — as a mail scanner does — must not use it up.
    expect((await resets.peekResetToken(token))?.userId).toBe(user.id);
    expect((await resets.peekResetToken(token))?.userId).toBe(user.id);

    expect(await resets.consumeResetToken(token)).toBe(user.id);
    expect(await resets.consumeResetToken(token)).toBeNull();
    expect(await resets.peekResetToken(token)).toBeNull();
  });

  it("stop working when a newer link is issued", async () => {
    const user = await makeUser("asked-twice", "twice@example.com");
    const first = await resets.issueResetToken(user.id, null);
    const second = await resets.issueResetToken(user.id, null);

    expect(await resets.consumeResetToken(first.token)).toBeNull();
    expect(await resets.consumeResetToken(second.token)).toBe(user.id);
  });

  it("stop working once expired", async () => {
    const user = await makeUser("too-late", "late@example.com");
    const { token } = await resets.issueResetToken(user.id, null);

    const { getDb } = await import("@/lib/client");
    const t = await import("@/lib/schema");
    const { eq } = await import("drizzle-orm");
    await getDb()
      .update(t.passwordResetTokens)
      .set({ expiresAt: Date.now() - 1 })
      .where(eq(t.passwordResetTokens.userId, user.id));

    expect(await resets.peekResetToken(token)).toBeNull();
    expect(await resets.consumeResetToken(token)).toBeNull();
  });

  it("are stored only as a hash", async () => {
    const user = await makeUser("hashed-token", "hashed@example.com");
    const { token } = await resets.issueResetToken(user.id, null);

    const { getDb } = await import("@/lib/client");
    const t = await import("@/lib/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await getDb()
      .select()
      .from(t.passwordResetTokens)
      .where(eq(t.passwordResetTokens.userId, user.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toContain(token);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reject junk without touching anything", async () => {
    expect(await resets.peekResetToken("")).toBeNull();
    expect(await resets.consumeResetToken("not-a-real-token-at-all")).toBeNull();
  });
});
