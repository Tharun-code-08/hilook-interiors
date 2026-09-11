/**
 * Domain types shared by the server, the repositories, and the components.
 *
 * These previously lived in lib/db.ts alongside the lowdb machinery. They are
 * deliberately *not* the Drizzle row types: the storage schema normalises
 * project images into their own table and stores timestamps as epoch numbers,
 * while the UI wants a project with a plain `images: string[]` and ISO dates.
 * The repositories are the seam that maps between the two, which is what lets
 * the storage layer change again without touching a component.
 */

export type Service = {
  id: string;
  name: string;
  description: string;
  image: string | null;
  order: number;
};

export type PortfolioProject = {
  id: string;
  title: string;
  /** URL-safe identifier, unique across projects. Used by Phase 5's routes. */
  slug: string;
  category: "Residential" | "Commercial";
  description: string;
  images: string[];
  order: number;
};

export type Review = {
  id: string;
  name: string;
  photo: string | null;
  rating: number;
  text: string;
  approved: boolean;
  featured: boolean;
  order: number;
};

export type Submission = {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: string;
  read: boolean;
  responded: boolean;
  /** Caught by a spam check and held for review rather than dropped. */
  flagged: boolean;
  /** Which check caught it: "honeypot" or "timing". */
  flagReason: string | null;
};

export type MediaItem = {
  id: string;
  filename: string;
  url: string;
  kind: "image" | "other";
  uploadedAt: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  alt?: string;
};

export type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string;
  role: "owner" | "editor";
  createdAt: string;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
};

/** The shape sent to the client — never carries passwordHash. */
export type PublicAdminUser = Omit<AdminUser, "passwordHash">;

export type AwardItem = {
  id: string;
  kind: "award" | "press" | "certification";
  title: string;
  detail: string;
  url: string | null;
};

export type ProcessStep = {
  id: string;
  title: string;
  body: string;
  order: number;
};

export type AuditEntry = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: string | null;
  ip: string | null;
};

export type Settings = {
  siteName: string;
  metaDescription: string;
  heroLabel: string;
  heroTitle: string;
  heroParagraph: string;
  heroCta: string;
  heroPhilosophyLabel: string;
  heroPhilosophyText: string;
  heroProcessLabel: string;
  heroProcessText: string;
  heroClosingLabel: string;
  heroClosingTitle: string;
  heroClosingCta: string;
  aboutLabel: string;
  aboutTitle: string;
  aboutBody: string;
  aboutCredentials: string;
  aboutImage: string;
  servicesLabel: string;
  servicesIntro: string;
  portfolioLabel: string;
  processSectionLabel: string;
  recognitionLabel: string;
  reviewsLabel: string;
  contactLabel: string;
  footerTagline: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  whatsappNumber: string;
  googleAnalyticsId: string;
  instagramUrl: string;
  pinterestUrl: string;
  facebookUrl: string;
};

/**
 * Defaults for every settings key.
 *
 * The store holds key/value rows, so a key that has never been written simply
 * isn't there. Merging reads over these defaults means a newly added setting
 * works immediately without a data migration — which is what the old backfill
 * loop in getDB() existed to do.
 */
export const DEFAULT_SETTINGS: Settings = {
  siteName: "Hilook Interiors",
  metaDescription:
    "Hilook Interiors — luxury interior design and architecture studio crafting premium residential and commercial spaces.",
  heroLabel: "Hilook Interiors",
  heroTitle: "Interiors Crafted for Extraordinary Living.",
  heroParagraph:
    "Hilook Interiors designs and builds residences and commercial spaces defined by considered architecture, natural materials, and quiet, enduring luxury — every detail resolved with the same care as the whole.",
  heroCta: "Explore Our Work",
  heroPhilosophyLabel: "Philosophy",
  heroPhilosophyText:
    "Every space begins with light, proportion, and material — layered with the same restraint and precision found in the finest architecture.",
  heroProcessLabel: "Process",
  heroProcessText:
    "From first consultation to final installation, we shape personalized spaces that transform how a home or business is experienced, room by room.",
  heroClosingLabel: "Designed for Living",
  heroClosingTitle: "Spaces Designed to Belong.",
  heroClosingCta: "Start Your Project",
  aboutLabel: "About Hilook Interiors",
  aboutTitle: "Editable About Heading — Update From the Admin Panel",
  aboutBody:
    "Editable placeholder — add the real Hilook Interiors brand story, founding narrative, and design philosophy here from the admin panel.",
  aboutCredentials: "Editable placeholder — add real designer credentials here when supplied.",
  aboutImage: "/images/about/featured.jpg",
  servicesLabel: "Our Services",
  servicesIntro: "Editable placeholder — a short line introducing your services list.",
  portfolioLabel: "Selected Projects",
  processSectionLabel: "How We Work",
  recognitionLabel: "Recognition",
  reviewsLabel: "Client Reviews",
  contactLabel: "Contact Us",
  footerTagline: "Luxury interior design and architecture, crafted with quiet precision.",
  contactEmail: "hello@hilookinteriors.example",
  contactPhone: "+91 00000 00000",
  contactAddress: "Editable placeholder — add your studio address from the admin panel.",
  whatsappNumber: "910000000000",
  googleAnalyticsId: "",
  instagramUrl: "",
  pinterestUrl: "",
  facebookUrl: "",
};
