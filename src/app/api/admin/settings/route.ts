import { NextRequest } from "next/server";
import { ok, handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSetting } from "@/lib/settings";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const [settings, flags, plans] = await Promise.all([
      getSettings(),
      import("@/lib/settings").then((m) => m.getFeatureFlags()),
      db.plan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true } }),
    ]);
    return ok({ settings, flags, plans });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await readJson<Record<string, unknown>>(req);
    const allowed = ["geminiModelFlash", "geminiModelPro", "geminiAutoModel", "emailVerificationRequired", "maintenanceMode", "defaultPlanSlug", "welcomeMessage"];
    for (const [key, value] of Object.entries(body)) {
      if (!allowed.includes(key)) continue;
      if (key === "geminiModelFlash" || key === "geminiModelPro" || key === "defaultPlanSlug" || key === "welcomeMessage") {
        await setSetting(key, String(value).slice(0, 120));
      } else {
        await setSetting(key, !!value);
      }
    }
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "settings.update", detail: Object.keys(body).join(",") } });
    const settings = await getSettings();
    return ok({ settings });
  } catch (e) {
    return handleError(e);
  }
}
