import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handleError, readJson, str, int, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const languages = await db.promptLanguage.findMany({ orderBy: { sortOrder: "asc" } });
    return ok({ languages });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await readJson<Record<string, unknown>>(req);
    const name = str(body.name, "Name", { min: 2, max: 40 });
    const nativeName = str(body.nativeName, "Native name", { min: 1, max: 40 });
    const code = str(body.code, "Code", { min: 2, max: 8 }).toLowerCase().replace(/[^a-z0-9-]/g, "");
    const exists = await db.promptLanguage.findUnique({ where: { code } });
    if (exists) throw new ApiError(409, "code_taken", "A language with this code already exists.");
    const created = await db.promptLanguage.create({
      data: { name, nativeName, code, sortOrder: int(body.sortOrder, "Sort order", { min: 0, max: 999, fallback: 10 }) },
    });
    await db.adminLog.create({ data: { adminUserId: admin.id, action: "language.create", detail: code } });
    return ok({ language: created }, 201);
  } catch (e) {
    return handleError(e);
  }
}
