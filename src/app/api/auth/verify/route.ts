import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson, str } from "@/lib/api";
import { sha256 } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await readJson<{ token?: string }>(req);
    const token = str(body.token, "Token", { max: 200 });
    const record = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.type !== "verify_email" || record.usedAt || record.expiresAt < new Date()) {
      return fail(400, "invalid_token", "This verification link is invalid or has expired.");
    }
    const user = await db.user.findUnique({ where: { email: record.email } });
    if (!user) return fail(400, "invalid_token", "This verification link is invalid.");
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
      db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    return ok({ verified: true });
  } catch (e) {
    return handleError(e);
  }
}
