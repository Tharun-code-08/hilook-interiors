import { z } from "zod";

/**
 * Every request body shape in one place.
 *
 * Replaces the hand-rolled `typeof x === "string" && x.trim()` checks that
 * were duplicated across 19 route handlers — each subtly different, none
 * bounding length, several silently coercing. Bounds matter here beyond
 * tidiness: unbounded strings in a JSON store that rewrites in full are a
 * storage and write-amplification problem, not just a data-quality one.
 *
 * Safe to import from client components — this module holds no secrets and
 * no server-only imports, so admin forms can validate against the same
 * schemas the API enforces.
 */

/* -------------------------------------------------------------------------
 * Primitives
 * ---------------------------------------------------------------------- */

const trimmed = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

/** Rejects protocol-relative and javascript: URLs; only http(s) or a site-relative path. */
const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("/") ||
      value.startsWith("http://") ||
      value.startsWith("https://"),
    { message: "Must be an http(s) URL or a path beginning with /" }
  )
  .refine((value) => !value.startsWith("//"), {
    message: "Protocol-relative URLs are not allowed",
  });

const email = z.email({ message: "Enter a valid email address" }).max(254);

/* -------------------------------------------------------------------------
 * Public endpoints
 * ---------------------------------------------------------------------- */

/**
 * Honeypot: a field hidden from sighted users and from assistive tech. A real
 * visitor never fills it; most naive bots fill every input they find.
 *
 * `startedAt` is the epoch ms the form was rendered. Humans take seconds to
 * write an enquiry; a submission arriving in under 3s is almost always
 * scripted. Both are advisory signals checked in the route, not hard schema
 * failures, so a legitimate fast paste is never silently lost.
 */
export const contactSchema = z.object({
  name: requiredText(120, "Name"),
  email,
  phone: trimmed(40).optional().default(""),
  message: requiredText(4000, "Message"),
  website: trimmed(200).optional().default(""),
  startedAt: z.number().int().positive().optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const newsletterSchema = z.object({
  email,
  website: trimmed(200).optional().default(""),
});

/**
 * Section-view beacon. The endpoint was previously unauthenticated *and*
 * unvalidated, so any client could invent section names in a loop — each new
 * key permanently growing the analytics map and forcing a full re-serialise.
 * An allowlist makes the key space finite.
 */
export const TRACKED_SECTIONS = [
  "about",
  "services",
  "portfolio",
  "process",
  "recognition",
  "reviews",
  "contact",
] as const;

export const sectionViewSchema = z.object({
  section: z.enum(TRACKED_SECTIONS),
});

/* -------------------------------------------------------------------------
 * Admin — content
 * ---------------------------------------------------------------------- */

/**
 * Create and update schemas are defined separately, and update schemas carry
 * NO defaults.
 *
 * The update variants were originally `createSchema.partial()`, which looked
 * right and silently destroyed data: `.partial()` makes a key optional but a
 * `.default()` on that key still fires when the key is absent. So a PUT
 * carrying only `{ title }` parsed into
 * `{ title, category: "Residential", description: "", images: [] }` — and the
 * repository dutifully wrote every one of those over the stored values.
 *
 * Renaming a project wiped its description, its category, and its entire
 * image list. A partial update must mean "change exactly what was sent", so
 * every field below is plainly optional with nothing behind it.
 */

const orderField = z.number().int().min(0).max(10_000).optional();

export const portfolioCreateSchema = z.object({
  title: requiredText(160, "Title"),
  category: z.enum(["Residential", "Commercial"]).default("Residential"),
  description: trimmed(8000).optional().default(""),
  images: z.array(safeUrl).max(60).optional().default([]),
});

export const portfolioUpdateSchema = z.object({
  title: requiredText(160, "Title").optional(),
  category: z.enum(["Residential", "Commercial"]).optional(),
  description: trimmed(8000).optional(),
  images: z.array(safeUrl).max(60).optional(),
  order: orderField,
});

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).max(500),
});

export const serviceCreateSchema = z.object({
  name: requiredText(120, "Name"),
  description: trimmed(4000).optional().default(""),
  image: safeUrl.nullable().optional().default(null),
});

export const serviceUpdateSchema = z.object({
  name: requiredText(120, "Name").optional(),
  description: trimmed(4000).optional(),
  image: safeUrl.nullable().optional(),
  order: orderField,
});

export const reviewCreateSchema = z.object({
  name: requiredText(120, "Name"),
  text: requiredText(4000, "Review"),
  rating: z.number().int().min(1).max(5).default(5),
  photo: safeUrl.nullable().optional().default(null),
  approved: z.boolean().optional().default(false),
  featured: z.boolean().optional().default(false),
});

export const reviewUpdateSchema = z.object({
  name: requiredText(120, "Name").optional(),
  text: requiredText(4000, "Review").optional(),
  rating: z.number().int().min(1).max(5).optional(),
  photo: safeUrl.nullable().optional(),
  approved: z.boolean().optional(),
  featured: z.boolean().optional(),
  order: orderField,
});

export const processCreateSchema = z.object({
  title: requiredText(160, "Title"),
  body: trimmed(4000).optional().default(""),
});

export const processUpdateSchema = z.object({
  title: requiredText(160, "Title").optional(),
  body: trimmed(4000).optional(),
  order: orderField,
});

export const awardCreateSchema = z.object({
  kind: z.enum(["award", "press", "certification"]).default("award"),
  title: requiredText(200, "Title"),
  detail: trimmed(1000).optional().default(""),
  url: safeUrl.nullable().optional().default(null),
});

export const awardUpdateSchema = z.object({
  kind: z.enum(["award", "press", "certification"]).optional(),
  title: requiredText(200, "Title").optional(),
  detail: trimmed(1000).optional(),
  url: safeUrl.nullable().optional(),
});

export const submissionUpdateSchema = z
  .object({
    read: z.boolean().optional(),
    responded: z.boolean().optional(),
  })
  .refine((value) => value.read !== undefined || value.responded !== undefined, {
    message: "Nothing to update",
  });

/* -------------------------------------------------------------------------
 * Admin — settings
 * ---------------------------------------------------------------------- */

/**
 * Settings are 34 free-text fields. The previous handler accepted any string
 * for any key, including googleAnalyticsId, which is interpolated into an
 * inline <script>. GoogleAnalytics.tsx does re-validate the format before
 * rendering, so this is defence in depth rather than a live hole — but the
 * validation belongs at the write boundary too.
 */
export const settingsUpdateSchema = z
  .object({
    googleAnalyticsId: z
      .string()
      .trim()
      .max(32)
      .refine((value) => value === "" || /^G-[A-Z0-9]+$/i.test(value), {
        message: "Must look like G-XXXXXXXXXX",
      })
      .optional(),
    contactEmail: z.union([email, z.literal("")]).optional(),
    instagramUrl: safeUrl.optional(),
    pinterestUrl: safeUrl.optional(),
    facebookUrl: safeUrl.optional(),
    aboutImage: safeUrl.optional(),
    whatsappNumber: z
      .string()
      .trim()
      .max(20)
      .refine((value) => value === "" || /^[0-9+\s()-]+$/.test(value), {
        message: "Digits, spaces, and + ( ) - only",
      })
      .optional(),
  })
  // Remaining copy fields: bounded text, no format constraint.
  .catchall(z.string().max(8000));

/* -------------------------------------------------------------------------
 * Admin — accounts
 * ---------------------------------------------------------------------- */

/**
 * 12 characters minimum, up from the previous 8. Length is the only property
 * that reliably resists offline cracking; composition rules mostly produce
 * predictable substitutions. Capped at 200 because bcrypt silently truncates
 * past 72 bytes and we would rather reject than quietly ignore the tail.
 */
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(200, "Password must be under 200 characters");

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(64),
  password: z.string().min(1, "Password is required").max(200),
});

export const userCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dot, dash, and underscore only"),
  password: passwordSchema,
  role: z.enum(["owner", "editor"]).default("editor"),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from the current one",
    path: ["newPassword"],
  });

/* -------------------------------------------------------------------------
 * Helper
 * ---------------------------------------------------------------------- */

export type ParseFailure = {
  ok: false;
  status: 400;
  error: string;
  fieldErrors: Record<string, string[]>;
};
export type ParseSuccess<T> = { ok: true; data: T };

/**
 * Parses a request body against a schema and returns a discriminated result,
 * so handlers read as a straight-line guard rather than a try/catch.
 *
 * Field errors are returned alongside the summary message so P6's admin forms
 * can render errors next to the field that caused them rather than as one
 * banner at the top.
 */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<ParseSuccess<z.infer<S>> | ParseFailure> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, status: 400, error: "Request body must be valid JSON", fieldErrors: {} };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    // flattenError's fieldErrors is keyed by the schema's own shape, which is
    // opaque behind the generic `S`. Widen it once here so callers get a
    // uniform Record back regardless of which schema was passed.
    const flat = z.flattenError(result.error);
    const fieldErrors = flat.fieldErrors as Record<string, string[] | undefined>;

    const firstField = Object.values(fieldErrors).find(
      (messages): messages is string[] => Array.isArray(messages) && messages.length > 0
    )?.[0];

    return {
      ok: false,
      status: 400,
      error: firstField ?? flat.formErrors[0] ?? "Invalid request",
      fieldErrors: fieldErrors as Record<string, string[]>,
    };
  }

  return { ok: true, data: result.data };
}
