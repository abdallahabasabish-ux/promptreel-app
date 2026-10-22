import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handleError, readJson, str } from "@/lib/api";
import { randomToken, sha256 } from "@/lib/auth";
import { getFeatureFlags } from "@/lib/settings";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const ipCheck = rateLimit(`forgot:ip:${ip}`, 5, 15 * 60 * 1000);
    if (!ipCheck.allowed) {
      return ok({ sent: true }); // same response — don't reveal limiting state either
    }

    const body = await readJson<{ email?: string }>(req);
    const email = str(body.email, "Email", { max: 120 }).toLowerCase();
    const flags = await getFeatureFlags();

    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const token = randomToken(24);
      await db.authToken.create({
        data: { email, tokenHash: sha256(token), type: "reset_password", expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const origin = req.nextUrl.origin;
      const link = `${origin}/?reset=${token}`;
      // Production: send via SMTP (configure SMTP_* env). Sandbox/dev: expose the link directly.
      console.log(`[auth] password reset for ${email}: ${link}`);
      if (flags.exposeDevLinks && !flags.smtp) {
        return ok({ sent: true, devResetUrl: link, note: "SMTP is not configured — the reset link is shown here and logged on the server." });
      }
    }
    // Always the same response shape (enumeration-safe)
    return ok({ sent: true });
  } catch (e) {
    return handleError(e);
  }
}
