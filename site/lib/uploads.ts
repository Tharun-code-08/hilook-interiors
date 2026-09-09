import "server-only";
import sharp from "sharp";

/**
 * Upload validation and normalisation.
 *
 * The route this replaces trusted two client-controlled values:
 *
 *   1. `file.type` — the MIME type the *browser* declares. Trivially forged.
 *   2. `path.extname(file.name)` — the extension the *user* chose, used
 *      verbatim as the stored file's extension.
 *
 * Together those meant a file named `payload.html`, declared as `image/png`,
 * was written to public/uploads/<id>.html and served as same-origin HTML —
 * stored XSS against every admin session. `image/svg+xml` was also on the
 * allowlist, and SVG is a script-bearing format.
 *
 * The fix is to never take the browser's word for anything:
 *
 *   - sniff the real format from the file's magic bytes;
 *   - decode and re-encode through sharp, which fails on anything that isn't
 *     genuinely a raster image and drops EXIF, colour profiles, and any
 *     appended payload in the process;
 *   - derive the extension from the format we just *produced*, never from
 *     input.
 */

/** Formats we accept and the extension each is stored as. */
const ACCEPTED = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
  avif: "avif",
} as const;

type AcceptedFormat = keyof typeof ACCEPTED;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Largest edge we keep. Beyond this is wasted bytes for a web page. */
const MAX_DIMENSION = 4000;

export type UploadResult =
  | {
      ok: true;
      buffer: Buffer;
      extension: string;
      contentType: string;
      width: number;
      height: number;
      bytes: number;
    }
  | { ok: false; error: string };

/**
 * Reads magic bytes to identify the container. sharp would reject a non-image
 * on its own, but sniffing first lets us give a precise error and refuse
 * SVG explicitly — sharp can rasterise SVG, and we do not want it near the
 * pipeline at all.
 */
function sniffFormat(buffer: Buffer): AcceptedFormat | "svg" | "unknown" {
  if (buffer.length < 12) return "unknown";

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // GIF: "GIF87a" / "GIF89a"
  if (
    buffer
      .subarray(0, 6)
      .toString("latin1")
      .match(/^GIF8[79]a$/)
  )
    return "gif";

  // RIFF container: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "webp";
  }

  // ISO-BMFF brands (AVIF/HEIF): bytes 4..8 are "ftyp", brand follows.
  if (buffer.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("latin1");
    if (brand === "avif" || brand === "avis") return "avif";
  }

  // SVG is text. Check a generous prefix for an <svg root, skipping any XML
  // declaration, comments, or doctype ahead of it.
  const head = buffer.subarray(0, 1024).toString("utf8").trimStart();
  if (head.startsWith("<?xml") || head.startsWith("<svg") || head.startsWith("<!DOCTYPE svg")) {
    if (/<svg[\s>]/i.test(head)) return "svg";
  }

  return "unknown";
}

/**
 * Validates and re-encodes an uploaded file.
 *
 * Returns the bytes to persist plus the extension and Content-Type to store
 * them under. The caller never sees, and must never use, the original
 * filename for anything but display.
 */
export async function processUpload(file: File): Promise<UploadResult> {
  if (file.size === 0) {
    return { ok: false, error: "That file is empty." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);
    return { ok: false, error: `Images must be under ${mb}MB.` };
  }

  const input = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffFormat(input);

  if (sniffed === "svg") {
    return {
      ok: false,
      error: "SVG files aren't accepted — they can carry scripts. Export as PNG or WebP instead.",
    };
  }
  if (sniffed === "unknown") {
    return {
      ok: false,
      error: "That doesn't look like an image. Accepted formats: JPEG, PNG, WebP, GIF, AVIF.",
    };
  }

  try {
    // `animated: true` preserves multi-frame GIF/WebP rather than silently
    // flattening an animation to its first frame.
    const pipeline = sharp(input, { animated: sniffed === "gif" || sniffed === "webp" });
    const metadata = await pipeline.metadata();

    if (!metadata.width || !metadata.height) {
      return { ok: false, error: "That image's dimensions couldn't be read." };
    }

    // Re-encode. This is the step that actually neutralises a polyglot file:
    // whatever was appended to or embedded in the original does not survive a
    // decode/encode round trip.
    let output = pipeline.rotate(); // applies EXIF orientation, then drops EXIF

    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      output = output.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    let buffer: Buffer;
    let format: AcceptedFormat;

    switch (sniffed) {
      case "png":
        buffer = await output.png({ compressionLevel: 9 }).toBuffer();
        format = "png";
        break;
      case "gif":
        buffer = await output.gif().toBuffer();
        format = "gif";
        break;
      case "avif":
        buffer = await output.avif({ quality: 72 }).toBuffer();
        format = "avif";
        break;
      case "webp":
        buffer = await output.webp({ quality: 82 }).toBuffer();
        format = "webp";
        break;
      case "jpeg":
      default:
        buffer = await output.jpeg({ quality: 86, mozjpeg: true }).toBuffer();
        format = "jpeg";
        break;
    }

    const final = await sharp(buffer).metadata();

    return {
      ok: true,
      buffer,
      extension: ACCEPTED[format],
      contentType: format === "jpeg" ? "image/jpeg" : `image/${format}`,
      width: final.width ?? metadata.width,
      height: final.height ?? metadata.height,
      bytes: buffer.byteLength,
    };
  } catch {
    return {
      ok: false,
      error: "That image couldn't be processed. It may be corrupt or use an unsupported variant.",
    };
  }
}

/**
 * Sanitises the original filename for *display only*. Never used to build a
 * path — stored files are named from a generated id plus the extension we
 * derived from the re-encoded output.
 */
/**
 * Characters that are invisible but change how the rest of the string reads.
 *
 * U+202E (RIGHT-TO-LEFT OVERRIDE) is the one that matters: "photo‮gpj.exe"
 * renders as "photoexe.jpg" in most UIs, so an operator sees an image where
 * the stored name is an executable. The rest of the bidi and zero-width block
 * enables variations of the same trick.
 */
function isInvisibleOrControl(codePoint: number): boolean {
  // C0 and C1 control characters.
  if (codePoint < 0x20) return true;
  if (codePoint >= 0x7f && codePoint <= 0x9f) return true;
  // Zero-width space / non-joiner / joiner, and the BOM.
  if (codePoint >= 0x200b && codePoint <= 0x200d) return true;
  if (codePoint === 0xfeff) return true;
  // Bidi marks, embeddings, overrides, and isolates.
  if (codePoint === 0x200e || codePoint === 0x200f) return true;
  if (codePoint >= 0x202a && codePoint <= 0x202e) return true;
  if (codePoint >= 0x2066 && codePoint <= 0x2069) return true;
  return false;
}

export function displayFilename(name: string): string {
  const stripped = Array.from(name)
    .filter((ch) => !isInvisibleOrControl(ch.codePointAt(0) ?? 0))
    .join("")
    // Path separators, so a displayed name can never read as a path.
    .split("/")
    .join("-")
    .split("\\")
    .join("-")
    .trim()
    .slice(0, 200);

  return stripped || "upload";
}
