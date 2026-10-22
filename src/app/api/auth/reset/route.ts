import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson, str } from "@/lib/api";
import { destroyAllSessions, sha256 } from "@/lib/auth";
import { hashPassword, passwordIssues } from "@/lib/password";

export async function POST(req: NextRequest) {
  try {
    const body = await readJson<{ token?: string; password?: string }>(req);
    const token = str(body.token, "Token", { max: 200 });
    const password = str(body.password, "Password", { min: 1, max: 200 });
    const issues = passwordIssues(password);
    if (issues.length) return fail(400, "weak_password", `Password needs ${issues.join(", ")}.`);

    const record = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.type !== "reset_password" || record.usedAt || record.expiresAt < new Date()) {
      return fail(400, "invalid_token", "This reset link is invalid or has expired. Request a new one.");
    }
    const user = await db.user.findUnique({ where: { email: record.email } });
    if (!user) return fail(400, "invalid_token", "This reset link is invalid or has expired. Request a new one.");

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } }),
      db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    await destroyAllSessions(user.id);
    return ok({ reset: true });
  } catch (e) {
    return handleError(e);
  }
}
