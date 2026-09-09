const fs = require("fs");
const path = require("path");

const dbPath = path.join(process.cwd(), "data", "db.json");

if (!fs.existsSync(dbPath)) {
  console.error(
    `\nCould not find ${dbPath}\n\n` +
      "Make sure you run this command from your project's root folder\n" +
      "(the same folder that contains package.json), and that you've run\n" +
      "`npm run dev` at least once already so data/db.json has been created.\n"
  );
  process.exit(1);
}

const raw = fs.readFileSync(dbPath, "utf-8");
let db;
try {
  db = JSON.parse(raw);
} catch (err) {
  console.error(`\nFailed to parse ${dbPath} as JSON:`, err.message);
  process.exit(1);
}

const backupPath = dbPath + `.backup-${Date.now()}.json`;
fs.writeFileSync(backupPath, raw);
console.log(`Backed up your current db.json to:\n  ${backupPath}\n`);

const newPortfolio = [
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
];

db.portfolio = newPortfolio;

if (!db.settings || typeof db.settings !== "object") {
  console.error(
    "\nYour db.json doesn't have a `settings` object — stopping without changes.\n"
  );
  process.exit(1);
}

db.settings.aboutImage = "/images/about/featured.jpg";

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

console.log("Done! Updated:");
console.log("  - db.portfolio (Hillside Residence + Sunset Terrace Residence, with real photos)");
console.log("  - db.settings.aboutImage -> /images/about/featured.jpg");
console.log("\nEverything else in data/db.json was left untouched.\n");
console.log("Next steps:");
console.log("  1. Restart your dev server (Ctrl+C, then `npm run dev`)");
console.log("  2. Hard-refresh your browser (Ctrl+Shift+R / Cmd+Shift+R)\n");