import path from "path";
import bcrypt from "bcryptjs";
import type { Low } from "lowdb";
import { JSONFilePreset } from "lowdb/node";

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
};

export type MediaItem = {
  id: string;
  filename: string;
  url: string;
  kind: "image" | "other";
  uploadedAt: string;
};

export type AdminUser = {
  id: string;
  username: string;
  passwordHash: string;
  role: "owner" | "editor";
  createdAt: string;
};

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

export type DBShape = {
  services: Service[];
  portfolio: PortfolioProject[];
  reviews: Review[];
  processSteps: ProcessStep[];
  submissions: Submission[];
  media: MediaItem[];
  users: AdminUser[];
  awards: AwardItem[];
  newsletterSubscribers: string[];
  settings: Settings;
  analytics: {
    pageviews: Record<string, number>;
    sections: Record<string, number>;
    referrers: Record<string, number>;
    totalVisits: number;
    dailyVisits: Record<string, number>;
  };
};

// Default admin credentials — CHANGE THESE after first login.
// username: admin / password: HilookAdmin!2026
const DEFAULT_ADMIN_PASSWORD_HASH = bcrypt.hashSync("HilookAdmin!2026", 10);

const defaultData: DBShape = {
  services: [
    {
      id: "svc-1",
      name: "Residential Interior Design",
      description:
        "Editable placeholder — describe your full-home design service here from the admin panel.",
      image: null,
      order: 0,
    },
    {
      id: "svc-2",
      name: "Commercial Interiors",
      description:
        "Editable placeholder — describe your commercial / hospitality design service here.",
      image: null,
      order: 1,
    },
    {
      id: "svc-3",
      name: "Architectural Consultation",
      description:
        "Editable placeholder — describe your architecture and space-planning service here.",
      image: null,
      order: 2,
    },
    {
      id: "svc-4",
      name: "Custom Furnishing & Sourcing",
      description:
        "Editable placeholder — describe your bespoke furnishing / procurement service here.",
      image: null,
      order: 3,
    },
  ],
  portfolio: [
    {
      id: "proj-1",
      title: "Hillside Residence",
      category: "Residential",
      description:
        "Editable placeholder project description — replace with the real project narrative from the admin panel. A full-home design spanning the exterior approach, an open living and dining plan, kitchen, primary bathroom, and bedroom.",
      images: [
        "/images/portfolio/hillside-residence/01-exterior.jpg",
        "/images/portfolio/hillside-residence/02-living-dining.jpg",
        "/images/portfolio/hillside-residence/03-kitchen.jpg",
        "/images/portfolio/hillside-residence/04-bathroom.jpg",
        "/images/portfolio/hillside-residence/05-bedroom.jpg",
      ],
      order: 0,
    },
    {
      id: "proj-2",
      title: "Sunset Terrace Residence",
      category: "Residential",
      description:
        "Editable placeholder project description — replace with the real project narrative from the admin panel. A rooftop terrace and living room pairing warm materials with an open, editorial feel.",
      images: [
        "/images/portfolio/sunset-terrace-residence/01-terrace.jpg",
        "/images/portfolio/sunset-terrace-residence/02-fireplace-living.jpg",
        "/images/portfolio/sunset-terrace-residence/03-living-room.jpg",
      ],
      order: 1,
    },
  ],
  reviews: [
    {
      id: "rev-1",
      name: "Sample Client",
      photo: null,
      rating: 5,
      text: "Editable placeholder testimonial — add real client reviews from the admin panel.",
      approved: true,
      featured: true,
      order: 0,
    },
  ],
  processSteps: [
    {
      id: "step-1",
      title: "Consultation",
      body: "We begin with a considered conversation about how you live or work — your goals, constraints, and the character you want the space to hold.",
      order: 0,
    },
    {
      id: "step-2",
      title: "Design",
      body: "Concepts are developed into a full design language: spatial planning, materials, lighting, and furnishings resolved together, not in isolation.",
      order: 1,
    },
    {
      id: "step-3",
      title: "Execution",
      body: "Every detail is realized on site with close oversight, from procurement through final installation, so the finished space matches the vision.",
      order: 2,
    },
  ],
  submissions: [],
  media: [],
  users: [
    {
      id: "user-1",
      username: "admin",
      passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
      role: "owner",
      createdAt: new Date().toISOString(),
    },
  ],
  awards: [],
  newsletterSubscribers: [],
  settings: {
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
    servicesIntro:
      "Editable placeholder — a short line introducing your services list.",
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
  },
  analytics: {
    pageviews: {},
    sections: {},
    referrers: {},
    totalVisits: 0,
    dailyVisits: {},
  },
};

const file = path.join(process.cwd(), "data", "db.json");

declare global {
  // eslint-disable-next-line no-var
  var __hilookDbPromise: Promise<Low<DBShape>> | undefined;
}

export function getDB(): Promise<Low<DBShape>> {
  if (!global.__hilookDbPromise) {
    global.__hilookDbPromise = JSONFilePreset<DBShape>(file, defaultData).then(async (db) => {
      // Backfill fields/collections added after this store may have first been written to disk.
      let dirty = false;

      if (!db.data.analytics.dailyVisits) {
        db.data.analytics.dailyVisits = {};
        dirty = true;
      }

      if (!db.data.processSteps) {
        db.data.processSteps = defaultData.processSteps;
        dirty = true;
      }

      for (const key of Object.keys(defaultData.settings) as (keyof Settings)[]) {
        if (db.data.settings[key] === undefined) {
          (db.data.settings as Settings)[key] = defaultData.settings[key];
          dirty = true;
        }
      }

      if (dirty) await db.write();
      return db;
    });
  }
  return global.__hilookDbPromise;
}
