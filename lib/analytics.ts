import "server-only";
import { getDB } from "./db";

const DAILY_HISTORY_DAYS = 90;

export async function recordPageview(path: string, referrer?: string | null) {
  const db = await getDB();
  db.data.analytics.pageviews[path] = (db.data.analytics.pageviews[path] || 0) + 1;
  db.data.analytics.totalVisits += 1;

  const today = new Date().toISOString().slice(0, 10);
  db.data.analytics.dailyVisits[today] = (db.data.analytics.dailyVisits[today] || 0) + 1;
  pruneOldDays(db.data.analytics.dailyVisits);

  if (referrer) {
    const host = safeHost(referrer);
    if (host) {
      db.data.analytics.referrers[host] = (db.data.analytics.referrers[host] || 0) + 1;
    }
  }
  await db.write();
}

function pruneOldDays(dailyVisits: Record<string, number>) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAILY_HISTORY_DAYS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  for (const key of Object.keys(dailyVisits)) {
    if (key < cutoffKey) delete dailyVisits[key];
  }
}

export async function recordSectionView(section: string) {
  const db = await getDB();
  db.data.analytics.sections[section] = (db.data.analytics.sections[section] || 0) + 1;
  await db.write();
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return "direct";
  }
}
