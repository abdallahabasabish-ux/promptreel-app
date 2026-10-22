import { ok, handleError } from "@/lib/api";
import { getSessionUser, toSafeUser } from "@/lib/auth";
import { getUsage } from "@/lib/quota";
import { getFeatureFlags, getSettings } from "@/lib/settings";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return ok({ user: null });
    const [usage, flags, settings, languages, plans] = await Promise.all([
      getUsage(user.id),
      getFeatureFlags(),
      getSettings(),
      dbSafeLanguages(),
      dbSafePlans(),
    ]);
    return ok({
      user: toSafeUser(user),
      usage,
      flags,
      settings: { welcomeMessage: settings.welcomeMessage },
      languages,
      plans,
    });
  } catch (e) {
    return handleError(e);
  }
}

async function dbSafeLanguages() {
  const { db } = await import("@/lib/db");
  return db.promptLanguage.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}
async function dbSafePlans() {
  const { db } = await import("@/lib/db");
  const rows = await db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  // features is stored as a JSON string — parse it so clients receive string[]
  return rows.map((p) => {
    let features: string[] = [];
    try { features = JSON.parse(p.features || "[]") as string[]; } catch { features = []; }
    if (!Array.isArray(features)) features = [];
    return { ...p, features };
  });
}
