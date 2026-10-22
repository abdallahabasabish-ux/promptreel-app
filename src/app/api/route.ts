import { NextResponse } from "next/server";

/** Public health endpoint — used by uptime monitors and the VPS Nginx/PM2 checks. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "CHAFIKTECH",
    service: "prompt-engine",
    time: new Date().toISOString(),
  });
}
