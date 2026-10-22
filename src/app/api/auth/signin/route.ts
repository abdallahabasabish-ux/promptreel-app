import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, handleError, readJson, str } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { verifyPassword, hashPassword } from "@/lib/password";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Constant-work dummy hash: evens out response timing when the user does not
// exist, so attackers can't enumerate registered emails via response latency.
const DUMMY_HASH = hashPassword("timing-equalizer-dummy-password");

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const ipCheck = rateLimit(`signin:ip:${ip}`, 20, 5 * 60 * 1000);
    if (!ipCheck.allowed) {
      return fail(429, "rate_limited", `Too many sign-in attempts. Try again in ${ipCheck.retryAfterSec}s.`);
    }

    const body = await readJson<{ email?: string; password?: string }>(req);
    const email = str(body.email, "Email", { max: 120 }).toLowerCase();
    const password = str(body.password, "Password", { max: 200 });

    const emailCheck = rateLimit(`signin:em:${email}`, 5, 5 * 60 * 1000);
    if (!emailCheck.allowed) {
      return fail(429, "rate_limited", `Too many sign-in attempts for this account. Try again in ${emailCheck.retryAfterSec}s.`);
    }

    const user = await db.user.findUnique({ where: { email } });
    const valid = user ? verifyPassword(password, user.passwordHash) : (verifyPassword(password, DUMMY_HASH), false);
    if (!user || !valid) {
      return fail(401, "invalid_credentials", "Incorrect email or password.");
    }
    if (user.status === "banned") {
      return fail(403, "banned", "This account has been suspended. Contact support.");
    }
    await createSession(user.id);
    return ok({ userId: user.id });
  } catch (e) {
    return handleError(e);
  }
}
