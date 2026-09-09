import "server-only";

/**
 * Where uploaded media actually lives.
 *
 * Writing into public/uploads was the second half of finding C1: on a
 * serverless host that directory is read-only at request time, and anything
 * written to the container's disk vanishes on the next cold start or deploy.
 *
 * Two drivers behind one interface:
 *
 *   local — writes to .storage/ (outside public/, so nothing is served
 *           statically) and streams bytes back through an authenticated-free
 *           but path-validated route handler. The default for dev and VPS.
 *   blob  — Vercel Blob. Selected automatically when BLOB_READ_WRITE_TOKEN is
 *           present. Files are stored remotely and served from Vercel's CDN.
 *
 * Callers only ever hold a *storage key* — the opaque `<id>.<ext>` produced at
 * upload. Turning that into a URL is the driver's job, so switching drivers
 * needs no change to stored data.
 */

export type StorageDriver = "local" | "blob";

export function activeDriver(): StorageDriver {
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

/** Public URL for a stored object. */
export function publicUrlFor(storageKey: string): string {
  if (activeDriver() === "blob") {
    const base = process.env.BLOB_PUBLIC_BASE_URL;
    // With a known CDN base we can link straight at it; otherwise fall through
    // to the route handler, which looks the object up and redirects.
    if (base) return `${base.replace(/\/+$/, "")}/${storageKey}`;
  }
  return `/api/media/${encodeURIComponent(storageKey)}`;
}

export type PutResult = { storageKey: string };

/** Persists bytes under `storageKey`. Overwrites if it already exists. */
export async function putObject(
  storageKey: string,
  body: Buffer,
  contentType: string
): Promise<PutResult> {
  if (activeDriver() === "blob") return putToBlob(storageKey, body, contentType);
  return putToLocal(storageKey, body);
}

/** Reads bytes back. Returns null when the object isn't there. */
export async function getObject(
  storageKey: string
): Promise<{ body: Buffer; contentType: string } | null> {
  if (activeDriver() === "blob") return getFromBlob(storageKey);
  return getFromLocal(storageKey);
}

export async function deleteObject(storageKey: string): Promise<void> {
  if (activeDriver() === "blob") return deleteFromBlob(storageKey);
  return deleteFromLocal(storageKey);
}

/* -------------------------------------------------------------------------
 * Key safety
 * ---------------------------------------------------------------------- */

/**
 * Storage keys are generated server-side as `<nanoid>.<ext>`, but they round
 * trip through the database and a URL path segment before coming back here,
 * so they are re-validated rather than trusted. Anything with a separator or
 * a traversal segment is rejected outright.
 */
export function isSafeStorageKey(key: string): boolean {
  if (!key || key.length > 128) return false;
  if (key.includes("/") || key.includes("\\")) return false;
  if (key.includes("..")) return false;
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9]{1,8}$/.test(key);
}

/* -------------------------------------------------------------------------
 * Local driver
 * ---------------------------------------------------------------------- */

/**
 * Deliberately NOT public/uploads. Serving user uploads from the static
 * directory is what made the stored-XSS in finding C2 reachable as
 * same-origin HTML; routing them through a handler lets us pin the
 * Content-Type and send nosniff regardless of what is on disk.
 */
function localRoot(): string {
  return `${process.cwd()}/.storage`;
}

async function putToLocal(storageKey: string, body: Buffer): Promise<PutResult> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  await mkdir(localRoot(), { recursive: true });
  await writeFile(path.join(localRoot(), storageKey), body);
  return { storageKey };
}

async function getFromLocal(
  storageKey: string
): Promise<{ body: Buffer; contentType: string } | null> {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  try {
    const body = await readFile(path.join(localRoot(), storageKey));
    return { body, contentType: contentTypeFromKey(storageKey) };
  } catch {
    return null;
  }
}

async function deleteFromLocal(storageKey: string): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  const path = await import("node:path");
  await unlink(path.join(localRoot(), storageKey)).catch(() => {});
}

/* -------------------------------------------------------------------------
 * Vercel Blob driver
 * ---------------------------------------------------------------------- */

/**
 * @vercel/blob is an optional dependency: installing it is only necessary for
 * a serverless deploy, and requiring it locally would force every contributor
 * to carry a package they never execute. The import is dynamic and the error
 * says exactly what to do.
 */
type BlobModule = {
  put: (key: string, body: Buffer, options: Record<string, unknown>) => Promise<{ url: string }>;
  head: (
    key: string,
    options: Record<string, unknown>
  ) => Promise<{ url: string; contentType?: string }>;
  del: (key: string, options: Record<string, unknown>) => Promise<void>;
};

async function blobClient(): Promise<BlobModule> {
  // The specifier is held in a variable so TypeScript doesn't try to resolve
  // it at build time: the package is only needed for a serverless deploy, and
  // requiring it locally would force every contributor to carry a dependency
  // they never execute.
  const specifier = "@vercel/blob";
  try {
    return (await import(/* webpackIgnore: true */ specifier)) as BlobModule;
  } catch {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is set but @vercel/blob is not installed. Run: npm install @vercel/blob"
    );
  }
}

async function putToBlob(
  storageKey: string,
  body: Buffer,
  contentType: string
): Promise<PutResult> {
  const { put } = await blobClient();
  await put(storageKey, body, {
    access: "public",
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  });
  return { storageKey };
}

async function getFromBlob(
  storageKey: string
): Promise<{ body: Buffer; contentType: string } | null> {
  const { head } = await blobClient();
  try {
    const meta = await head(storageKey, { token: process.env.BLOB_READ_WRITE_TOKEN });
    const res = await fetch(meta.url);
    if (!res.ok) return null;
    return {
      body: Buffer.from(await res.arrayBuffer()),
      contentType: meta.contentType ?? contentTypeFromKey(storageKey),
    };
  } catch {
    return null;
  }
}

async function deleteFromBlob(storageKey: string): Promise<void> {
  const { del } = await blobClient();
  await del(storageKey, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});
}

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

/**
 * Content-Type from the extension we ourselves assigned at upload — never
 * from anything the client said. lib/uploads.ts derives that extension from
 * the re-encoded output, so this can only ever resolve to a raster image type.
 */
export function contentTypeFromKey(storageKey: string): string {
  const ext = storageKey.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? "application/octet-stream";
}
