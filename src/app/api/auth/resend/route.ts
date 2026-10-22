import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api";
import { getSessionUser, randomToken, sha256 } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFeatureFlags } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return ok({ sent: true });
    const flags = await getFeatureFlags();
    if (!user.emailVerifiedAt) {
      const token = randomToken(24);
      await db.authToken.create({
        data: { email: user.email, tokenHash: sha256(token), type: "verify_email", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      });
      const link = `${req.nextUrl.origin}/?verify=${token}`;
      console.log(`[auth] email verification for ${user.email}: ${link}`);
      if (flags.exposeDevLinks && !flags.smtp) {
        return ok({ sent: true, devVerifyUrl: link, note: "SMTP is not configured — the verification link is shown here." });
      }
    }
    return ok({ sent: true });
  } catch (e) {
    return handleError(e);
  }
}
