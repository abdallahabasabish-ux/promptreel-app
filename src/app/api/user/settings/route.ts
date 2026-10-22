import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson<{ name?: string; theme?: string; defaultSceneCount?: number; defaultLanguageCode?: string }>(req);
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2 || name.length > 60) return fail(400, "validation_error", "Name must be 2-60 characters.");
      data.name = name;
    }
    if (body.theme !== undefined) {
      if (!["system", "light", "dark"].includes(body.theme)) return fail(400, "validation_error", "Invalid theme.");
      data.theme = body.theme;
    }
    if (body.defaultSceneCount !== undefined) {
      const n = Number(body.defaultSceneCount);
      if (!Number.isInteger(n) || n < 1 || n > 8) return fail(400, "validation_error", "Scene count must be 1-8.");
      data.defaultSceneCount = n;
    }
    if (body.defaultLanguageCode !== undefined) {
      const lang = await db.promptLanguage.findUnique({ where: { code: String(body.defaultLanguageCode) } });
      if (!lang || !lang.isActive) return fail(400, "validation_error", "Invalid language.");
      data.defaultLanguageCode = lang.code;
    }
    const updated = await db.user.update({ where: { id: user.id }, data });
    return ok({ theme: updated.theme, name: updated.name, defaultSceneCount: updated.defaultSceneCount, defaultLanguageCode: updated.defaultLanguageCode });
  } catch (e) {
    return handleError(e);
  }
}
