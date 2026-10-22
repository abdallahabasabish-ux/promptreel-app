import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson, str } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { hashPassword, passwordIssues } from "@/lib/password";
import { getSettings } from "@/lib/settings";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const ipCheck = rateLimit(`signup:ip:${ip}`, 5, 60 * 60 * 1000);
    if (!ipCheck.allowed) {
      return fail(429, "rate_limited", `Too many accounts created from this network. Try again in ${Math.ceil(ipCheck.retryAfterSec / 60)} min.`);
    }

    const body = await readJson<{ name?: string; email?: string; password?: string }>(req);
    const name = str(body.name, "Name", { min: 2, max: 60 });
    const email = str(body.email, "Email", { min: 5, max: 120 }).toLowerCase();
    const password = str(body.password, "Password", { min: 1, max: 200 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "validation_error", "Please enter a valid email address.");

    const issues = passwordIssues(password);
    if (issues.length) return fail(400, "weak_password", `Password needs ${issues.join(", ")}.`);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return fail(409, "email_taken", "This email is already registered. Try signing in instead.");

    const settings = await getSettings();
    const defaultPlan = await db.plan.findFirst({ where: { isActive: true, slug: settings.defaultPlanSlug } })
      ?? await db.plan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        emailVerifiedAt: settings.emailVerificationRequired ? null : new Date(),
        planId: defaultPlan?.id,
        defaultLanguageCode: "en",
      },
    });

    await createSession(user.id);
    return ok({ userId: user.id });
  } catch (e) {
    return handleError(e);
  }
}
