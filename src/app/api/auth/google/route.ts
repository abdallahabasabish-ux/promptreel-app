import { NextRequest, NextResponse } from "next/server";
import { randomToken } from "@/lib/auth";
import { getFeatureFlags } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const flags = await getFeatureFlags();
  if (!flags.googleOAuth) {
    return NextResponse.json({ ok: false, error: { code: "not_configured", message: "Google sign-in is not configured on this server." } }, { status: 404 });
  }
  const state = randomToken(16);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${req.nextUrl.origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set("pr_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return res;
}
