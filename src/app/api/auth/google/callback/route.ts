import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

type GoogleTokenResponse = { access_token?: string; error?: string };
type GoogleUserInfo = { sub?: string; email?: string; name?: string; email_verified?: boolean };

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get("pr_oauth_state")?.value;

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(`${origin}/?authError=google_state`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }).toString(),
    });
    const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenJson.access_token) return NextResponse.redirect(`${origin}/?authError=google_token`);

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const info = (await infoRes.json()) as GoogleUserInfo;
    if (!infoRes.ok || !info.sub || !info.email) return NextResponse.redirect(`${origin}/?authError=google_profile`);

    const email = info.email.toLowerCase();
    const settings = await getSettings();
    const defaultPlan = await db.plan.findFirst({ where: { isActive: true, slug: settings.defaultPlanSlug } });

    let user = await db.user.findUnique({ where: { googleId: info.sub } });
    if (!user) {
      const byEmail = await db.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await db.user.update({ where: { id: byEmail.id }, data: { googleId: info.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() } });
      } else {
        user = await db.user.create({
          data: {
            email,
            name: info.name || email.split("@")[0],
            googleId: info.sub,
            emailVerifiedAt: new Date(),
            planId: defaultPlan?.id,
          },
        });
      }
    }
    if (user.status === "banned") return NextResponse.redirect(`${origin}/?authError=banned`);

    await createSession(user.id);
    const res = NextResponse.redirect(origin + "/");
    res.cookies.set("pr_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/?authError=google_failed`);
  }
}
