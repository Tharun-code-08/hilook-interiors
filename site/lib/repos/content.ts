import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../client";
import * as t from "../schema";
import type { AwardItem, PortfolioProject, ProcessStep, Review, Service } from "../types";

/**
 * Content repositories.
 *
 * Route handlers talk to these instead of the store directly. That boundary is
 * where the C5 fix lives: an update is one statement or one transaction, not a
 * read-modify-write of an entire document, so concurrent saves can no longer
 * lose each other.
 */

/* -------------------------------------------------------------------------
 * Services
 * ---------------------------------------------------------------------- */

export async function listServices(): Promise<Service[]> {
  const rows = await getDb().select().from(t.services).orderBy(asc(t.services.position));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    image: r.image,
    order: r.position,
  }));
}

export async function createService(input: {
  name: string;
  description: string;
  image: string | null;
}): Promise<Service> {
  const db = getDb();
  const id = nanoid();

  // Sub-select for position rather than reading the count and writing it back:
  // two simultaneous creates would otherwise both read the same count and land
  // on the same position.
  await db.insert(t.services).values({
    id,
    name: input.name,
    description: input.description,
    image: input.image,
    position: sql`(SELECT COALESCE(MAX(position), -1) + 1 FROM ${t.services})`,
  });

  const [row] = await db.select().from(t.services).where(eq(t.services.id, id));
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    image: row.image,
    order: row.position,
  };
}

export async function updateService(
  id: string,
  patch: Partial<{ name: string; description: string; image: string | null; order: number }>
): Promise<Service | null> {
  const db = getDb();
  const values: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.image !== undefined) values.image = patch.image;
  if (patch.order !== undefined) values.position = patch.order;

  await db.update(t.services).set(values).where(eq(t.services.id, id));
  const [row] = await db.select().from(t.services).where(eq(t.services.id, id));
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    image: row.image,
    order: row.position,
  };
}

export async function deleteService(id: string): Promise<Service | null> {
  const db = getDb();
  const [row] = await db.select().from(t.services).where(eq(t.services.id, id));
  if (!row) return null;
  await db.delete(t.services).where(eq(t.services.id, id));
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    image: row.image,
    order: row.position,
  };
}

/* -------------------------------------------------------------------------
 * Portfolio projects
 * ---------------------------------------------------------------------- */

/** Collapses the normalised image rows back into the `images: string[]` the UI expects. */
async function hydrateProjects(
  rows: (typeof t.projects.$inferSelect)[]
): Promise<PortfolioProject[]> {
  if (rows.length === 0) return [];

  // One query for every project's images rather than one per project.
  const images = await getDb()
    .select()
    .from(t.projectImages)
    .where(
      inArray(
        t.projectImages.projectId,
        rows.map((r) => r.id)
      )
    )
    .orderBy(asc(t.projectImages.position));

  const byProject = new Map<string, string[]>();
  for (const img of images) {
    const list = byProject.get(img.projectId) ?? [];
    list.push(img.url);
    byProject.set(img.projectId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    category: r.category,
    description: r.description,
    images: byProject.get(r.id) ?? [],
    order: r.position,
  }));
}

export async function listProjects(): Promise<PortfolioProject[]> {
  const rows = await getDb().select().from(t.projects).orderBy(asc(t.projects.position));
  return hydrateProjects(rows);
}

export async function getProjectBySlug(slug: string): Promise<PortfolioProject | null> {
  const rows = await getDb().select().from(t.projects).where(eq(t.projects.slug, slug));
  const [project] = await hydrateProjects(rows);
  return project ?? null;
}

/** "Hillside Residence" -> "hillside-residence", suffixed until unique. */
export async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "project";

  const existing = await getDb()
    .select({ slug: t.projects.slug, id: t.projects.id })
    .from(t.projects);
  const taken = new Set(existing.filter((r) => r.id !== excludeId).map((r) => r.slug));

  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

export async function createProject(input: {
  title: string;
  category: "Residential" | "Commercial";
  description: string;
  images: string[];
}): Promise<PortfolioProject> {
  const db = getDb();
  const id = nanoid();
  const slug = await uniqueSlug(input.title);

  // The project and its images are one unit — a project that half-inserted its
  // images would render with a partial gallery and no sign anything failed.
  await db.transaction(async (tx) => {
    await tx.insert(t.projects).values({
      id,
      title: input.title,
      slug,
      category: input.category,
      description: input.description,
      position: sql`(SELECT COALESCE(MAX(position), -1) + 1 FROM ${t.projects})`,
    });

    if (input.images.length > 0) {
      await tx.insert(t.projectImages).values(
        input.images.map((url, i) => ({
          id: nanoid(),
          projectId: id,
          url,
          alt: "",
          position: i,
        }))
      );
    }
  });

  const rows = await db.select().from(t.projects).where(eq(t.projects.id, id));
  const [project] = await hydrateProjects(rows);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<{
    title: string;
    category: "Residential" | "Commercial";
    description: string;
    images: string[];
    order: number;
  }>
): Promise<PortfolioProject | null> {
  const db = getDb();

  const [existing] = await db.select().from(t.projects).where(eq(t.projects.id, id));
  if (!existing) return null;

  await db.transaction(async (tx) => {
    const values: Record<string, unknown> = { updatedAt: Date.now() };
    if (patch.title !== undefined) {
      values.title = patch.title;
      // Keep the slug in step with the title, but only when it actually
      // changed — regenerating on every save would break existing links.
      if (patch.title !== existing.title) {
        values.slug = await uniqueSlug(patch.title, id);
      }
    }
    if (patch.category !== undefined) values.category = patch.category;
    if (patch.description !== undefined) values.description = patch.description;
    if (patch.order !== undefined) values.position = patch.order;

    await tx.update(t.projects).set(values).where(eq(t.projects.id, id));

    if (patch.images !== undefined) {
      // Replace wholesale: the client sends the full ordered list, and
      // diffing it would be more code for no behavioural gain.
      await tx.delete(t.projectImages).where(eq(t.projectImages.projectId, id));
      if (patch.images.length > 0) {
        await tx.insert(t.projectImages).values(
          patch.images.map((url, i) => ({
            id: nanoid(),
            projectId: id,
            url,
            alt: "",
            position: i,
          }))
        );
      }
    }
  });

  const rows = await db.select().from(t.projects).where(eq(t.projects.id, id));
  const [project] = await hydrateProjects(rows);
  return project ?? null;
}

export async function deleteProject(id: string): Promise<PortfolioProject | null> {
  const db = getDb();
  const rows = await db.select().from(t.projects).where(eq(t.projects.id, id));
  if (rows.length === 0) return null;
  const [project] = await hydrateProjects(rows);

  // project_images has ON DELETE CASCADE, so the rows go with it.
  await db.delete(t.projects).where(eq(t.projects.id, id));
  return project;
}

/**
 * Applies a new ordering.
 *
 * One transaction: a half-applied reorder leaves duplicate positions and the
 * grid renders in an order nobody chose.
 */
export async function reorderProjects(ids: string[]): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx.update(t.projects).set({ position: index }).where(eq(t.projects.id, id));
    }
  });
}

export async function allProjectIds(): Promise<string[]> {
  const rows = await getDb().select({ id: t.projects.id }).from(t.projects);
  return rows.map((r) => r.id);
}

/* -------------------------------------------------------------------------
 * Reviews
 * ---------------------------------------------------------------------- */

function toReview(r: typeof t.reviews.$inferSelect): Review {
  return {
    id: r.id,
    name: r.name,
    photo: r.photo,
    rating: r.rating,
    text: r.text,
    approved: r.approved,
    featured: r.featured,
    order: r.position,
  };
}

export async function listReviews(): Promise<Review[]> {
  const rows = await getDb().select().from(t.reviews).orderBy(asc(t.reviews.position));
  return rows.map(toReview);
}

export async function listApprovedReviews(): Promise<Review[]> {
  const rows = await getDb()
    .select()
    .from(t.reviews)
    .where(eq(t.reviews.approved, true))
    .orderBy(asc(t.reviews.position));
  return rows.map(toReview);
}

export async function createReview(input: {
  name: string;
  text: string;
  rating: number;
  photo: string | null;
  approved: boolean;
  featured: boolean;
}): Promise<Review> {
  const db = getDb();
  const id = nanoid();
  await db.insert(t.reviews).values({
    id,
    ...input,
    position: sql`(SELECT COALESCE(MAX(position), -1) + 1 FROM ${t.reviews})`,
  });
  const [row] = await db.select().from(t.reviews).where(eq(t.reviews.id, id));
  return toReview(row);
}

export async function updateReview(
  id: string,
  patch: Partial<{
    name: string;
    text: string;
    rating: number;
    photo: string | null;
    approved: boolean;
    featured: boolean;
    order: number;
  }>
): Promise<Review | null> {
  const db = getDb();
  const values: Record<string, unknown> = { updatedAt: Date.now() };
  for (const key of ["name", "text", "rating", "photo", "approved", "featured"] as const) {
    if (patch[key] !== undefined) values[key] = patch[key];
  }
  if (patch.order !== undefined) values.position = patch.order;

  await db.update(t.reviews).set(values).where(eq(t.reviews.id, id));
  const [row] = await db.select().from(t.reviews).where(eq(t.reviews.id, id));
  return row ? toReview(row) : null;
}

export async function deleteReview(id: string): Promise<Review | null> {
  const db = getDb();
  const [row] = await db.select().from(t.reviews).where(eq(t.reviews.id, id));
  if (!row) return null;
  await db.delete(t.reviews).where(eq(t.reviews.id, id));
  return toReview(row);
}

/* -------------------------------------------------------------------------
 * Process steps
 * ---------------------------------------------------------------------- */

export async function listProcessSteps(): Promise<ProcessStep[]> {
  const rows = await getDb().select().from(t.processSteps).orderBy(asc(t.processSteps.position));
  return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, order: r.position }));
}

export async function createProcessStep(input: {
  title: string;
  body: string;
}): Promise<ProcessStep> {
  const db = getDb();
  const id = nanoid();
  await db.insert(t.processSteps).values({
    id,
    ...input,
    position: sql`(SELECT COALESCE(MAX(position), -1) + 1 FROM ${t.processSteps})`,
  });
  const [row] = await db.select().from(t.processSteps).where(eq(t.processSteps.id, id));
  return { id: row.id, title: row.title, body: row.body, order: row.position };
}

export async function updateProcessStep(
  id: string,
  patch: Partial<{ title: string; body: string; order: number }>
): Promise<ProcessStep | null> {
  const db = getDb();
  const values: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.body !== undefined) values.body = patch.body;
  if (patch.order !== undefined) values.position = patch.order;

  await db.update(t.processSteps).set(values).where(eq(t.processSteps.id, id));
  const [row] = await db.select().from(t.processSteps).where(eq(t.processSteps.id, id));
  return row ? { id: row.id, title: row.title, body: row.body, order: row.position } : null;
}

export async function deleteProcessStep(id: string): Promise<ProcessStep | null> {
  const db = getDb();
  const [row] = await db.select().from(t.processSteps).where(eq(t.processSteps.id, id));
  if (!row) return null;
  await db.delete(t.processSteps).where(eq(t.processSteps.id, id));
  return { id: row.id, title: row.title, body: row.body, order: row.position };
}

/* -------------------------------------------------------------------------
 * Awards
 * ---------------------------------------------------------------------- */

function toAward(r: typeof t.awards.$inferSelect): AwardItem {
  return { id: r.id, kind: r.kind, title: r.title, detail: r.detail, url: r.url };
}

export async function listAwards(): Promise<AwardItem[]> {
  const rows = await getDb().select().from(t.awards).orderBy(asc(t.awards.position));
  return rows.map(toAward);
}

export async function createAward(input: {
  kind: "award" | "press" | "certification";
  title: string;
  detail: string;
  url: string | null;
}): Promise<AwardItem> {
  const db = getDb();
  const id = nanoid();
  await db.insert(t.awards).values({
    id,
    ...input,
    position: sql`(SELECT COALESCE(MAX(position), -1) + 1 FROM ${t.awards})`,
  });
  const [row] = await db.select().from(t.awards).where(eq(t.awards.id, id));
  return toAward(row);
}

export async function updateAward(
  id: string,
  patch: Partial<{
    kind: "award" | "press" | "certification";
    title: string;
    detail: string;
    url: string | null;
  }>
): Promise<AwardItem | null> {
  const db = getDb();
  const values: Record<string, unknown> = {};
  for (const key of ["kind", "title", "detail", "url"] as const) {
    if (patch[key] !== undefined) values[key] = patch[key];
  }
  if (Object.keys(values).length > 0) {
    await db.update(t.awards).set(values).where(eq(t.awards.id, id));
  }
  const [row] = await db.select().from(t.awards).where(eq(t.awards.id, id));
  return row ? toAward(row) : null;
}

export async function deleteAward(id: string): Promise<AwardItem | null> {
  const db = getDb();
  const [row] = await db.select().from(t.awards).where(eq(t.awards.id, id));
  if (!row) return null;
  await db.delete(t.awards).where(eq(t.awards.id, id));
  return toAward(row);
}
