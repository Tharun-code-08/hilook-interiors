import { NextResponse } from "next/server";
import { getObject, isSafeStorageKey } from "@/lib/storage";

/**
 * Serves uploaded media.
 *
 * Uploads no longer live in public/, so they need a route to reach the
 * browser. Doing it here rather than statically is also what lets us pin the
 * Content-Type to one derived from the *re-encoded* bytes and always send
 * nosniff — the second half of the stored-XSS fix in finding C2.
 *
 * Public on purpose: these are the images on the public site.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  // Keys are generated server-side, but they round trip through the database
  // and a URL segment, so they are re-validated rather than trusted.
  if (!isSafeStorageKey(key)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const object = await getObject(key);
  if (!object) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      "Content-Type": object.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      // Content-addressed by a random id, so it never changes under a key.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
