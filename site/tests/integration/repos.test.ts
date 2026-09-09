import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";

const testDb = createTestDatabase();

// Imported dynamically so the env the helper sets is in place before
// lib/client.ts caches a connection.
type Content = typeof import("@/lib/repos/content");
type Settings = typeof import("@/lib/repos/settings");
type Ops = typeof import("@/lib/repos/operations");

let content: Content;
let settings: Settings;
let ops: Ops;

beforeAll(async () => {
  await testDb.migrate();
  content = await import("@/lib/repos/content");
  settings = await import("@/lib/repos/settings");
  ops = await import("@/lib/repos/operations");
});

afterAll(() => testDb.cleanup());

describe("projects", () => {
  it("stores images as ordered rows and reads them back in order", async () => {
    const created = await content.createProject({
      title: "Hillside Residence",
      category: "Residential",
      description: "A full-home design.",
      images: ["/a.jpg", "/b.jpg", "/c.jpg"],
    });

    expect(created.images).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
    expect(created.slug).toBe("hillside-residence");
  });

  it("generates a unique slug when two projects share a title", async () => {
    const a = await content.createProject({
      title: "Garden Villa",
      category: "Residential",
      description: "",
      images: [],
    });
    const b = await content.createProject({
      title: "Garden Villa",
      category: "Residential",
      description: "",
      images: [],
    });

    expect(a.slug).toBe("garden-villa");
    expect(b.slug).toBe("garden-villa-2");
  });

  /**
   * The regression that matters most. A title-only update used to wipe the
   * description, category and every image, because the update schema carried
   * defaults. This asserts the repository half of that contract.
   */
  it("a partial update leaves untouched fields alone", async () => {
    const created = await content.createProject({
      title: "Preserve Me",
      category: "Commercial",
      description: "KEEP THIS",
      images: ["/x.jpg", "/y.jpg"],
    });

    const updated = await content.updateProject(created.id, { title: "Renamed" });

    expect(updated?.title).toBe("Renamed");
    expect(updated?.category).toBe("Commercial");
    expect(updated?.description).toBe("KEEP THIS");
    expect(updated?.images).toEqual(["/x.jpg", "/y.jpg"]);
  });

  it("regenerates the slug when the title changes, and only then", async () => {
    const created = await content.createProject({
      title: "Original Name",
      category: "Residential",
      description: "",
      images: [],
    });

    const renamed = await content.updateProject(created.id, { title: "Brand New Name" });
    expect(renamed?.slug).toBe("brand-new-name");

    // A description-only edit must not move the URL out from under any link.
    const described = await content.updateProject(created.id, { description: "new copy" });
    expect(described?.slug).toBe("brand-new-name");
  });

  it("replaces the whole image list when one is supplied", async () => {
    const created = await content.createProject({
      title: "Gallery Swap",
      category: "Residential",
      description: "",
      images: ["/1.jpg", "/2.jpg", "/3.jpg"],
    });

    const updated = await content.updateProject(created.id, { images: ["/only.jpg"] });
    expect(updated?.images).toEqual(["/only.jpg"]);
  });

  it("cascades image rows on delete rather than orphaning them", async () => {
    const created = await content.createProject({
      title: "Doomed Project",
      category: "Residential",
      description: "",
      images: ["/p.jpg", "/q.jpg"],
    });

    await content.deleteProject(created.id);

    expect(await content.getProjectBySlug("doomed-project")).toBeNull();
    // If the foreign key weren't cascading, these rows would linger forever.
    const all = await content.listProjects();
    expect(all.find((p) => p.id === created.id)).toBeUndefined();
  });

  it("reorders in one transaction, leaving no duplicate positions", async () => {
    const ids = (await content.listProjects()).map((p) => p.id);
    const reversed = [...ids].reverse();

    await content.reorderProjects(reversed);

    const after = await content.listProjects();
    expect(after.map((p) => p.id)).toEqual(reversed);
    expect(new Set(after.map((p) => p.order)).size).toBe(after.length);
  });
});

describe("concurrency", () => {
  /**
   * The JSON store lost all but one of these: every writer read the whole
   * document, mutated its copy and wrote it back. This is the C5 regression.
   */
  it("keeps every one of 30 concurrent creates, with distinct positions", async () => {
    const before = (await content.listServices()).length;

    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        content.createService({ name: `Concurrent ${i}`, description: "", image: null })
      )
    );

    const after = await content.listServices();
    expect(after.length).toBe(before + 30);
    expect(new Set(after.map((s) => s.order)).size).toBe(after.length);
  });

  it("keeps concurrent writes to distinct settings keys", async () => {
    await Promise.all([
      settings.updateSettings({ siteName: "Concurrent Name" }),
      settings.updateSettings({ contactEmail: "concurrent@example.com" }),
      settings.updateSettings({ footerTagline: "Concurrent tagline" }),
    ]);

    const result = await settings.getSettings();
    expect(result.siteName).toBe("Concurrent Name");
    expect(result.contactEmail).toBe("concurrent@example.com");
    expect(result.footerTagline).toBe("Concurrent tagline");
  });
});

describe("settings", () => {
  it("falls back to defaults for keys never written", async () => {
    const result = await settings.getSettings();
    // Present in DEFAULT_SETTINGS, never written by these tests.
    expect(result.heroCta).toBe("Explore Our Work");
  });

  it("reports only the keys that actually changed", async () => {
    await settings.updateSettings({ reviewsLabel: "Testimonials" });
    const second = await settings.updateSettings({ reviewsLabel: "Testimonials" });
    expect(second.changed).toEqual([]);

    const third = await settings.updateSettings({ reviewsLabel: "What Clients Say" });
    expect(third.changed).toEqual(["reviewsLabel"]);
  });

  it("refuses keys that aren't part of the Settings shape", async () => {
    // The API schema has a catchall, so without this an arbitrary key could be
    // persisted and then served on every page render.
    await settings.updateSettings({ notARealSetting: "x" } as never);
    const result = await settings.getSettings();
    expect(result).not.toHaveProperty("notARealSetting");
  });
});

describe("users", () => {
  it("rejects a duplicate username case-insensitively", async () => {
    const first = await ops.createUser({
      username: "Designer",
      password: "a-long-enough-passphrase",
      role: "editor",
    });
    expect(first.ok).toBe(true);

    // Login compares case-insensitively, so "designer" and "Designer" must
    // not be able to exist as two accounts.
    const second = await ops.createUser({
      username: "designer",
      password: "another-long-passphrase",
      role: "editor",
    });
    expect(second.ok).toBe(false);
  });

  it("finds a user regardless of the case typed at login", async () => {
    expect((await ops.findUserByUsername("DESIGNER"))?.username).toBe("Designer");
  });

  it("never exposes the password hash in the list", async () => {
    const list = await ops.listUsers();
    for (const user of list) {
      expect(user).not.toHaveProperty("passwordHash");
    }
  });

  it("flags new accounts for a forced password change", async () => {
    const created = await ops.createUser({
      username: "newcomer",
      password: "a-long-enough-passphrase",
      role: "editor",
    });
    expect(created.ok && created.user.mustChangePassword).toBe(true);
  });

  it("clears the flag once a password is set", async () => {
    const user = await ops.findUserByUsername("newcomer");
    await ops.setPassword(user!.id, "a-different-long-passphrase");

    const after = await ops.findUserById(user!.id);
    expect(after?.mustChangePassword).toBe(false);
    expect(after?.passwordChangedAt).not.toBeNull();
  });
});

describe("submissions", () => {
  it("counts unread separately from the total", async () => {
    await ops.createSubmission({
      name: "A Client",
      email: "client@example.com",
      phone: "",
      message: "I'd like to discuss a project.",
    });

    const stats = await ops.submissionStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.unread).toBe(stats.total);
  });

  it("marks read without touching responded", async () => {
    const [first] = await ops.listSubmissions();
    const updated = await ops.updateSubmission(first.id, { read: true });

    expect(updated?.read).toBe(true);
    expect(updated?.responded).toBe(false);
  });
});

describe("newsletter", () => {
  it("de-duplicates addresses case-insensitively", async () => {
    await ops.subscribe("Someone@Example.com");
    await ops.subscribe("someone@example.com");
    await ops.subscribe("SOMEONE@EXAMPLE.COM");

    expect(await ops.subscriberCount()).toBe(1);
  });
});
