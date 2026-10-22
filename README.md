# CHAFIKTECH — AI Video Scene Prompt Generator

**CHAFIKTECH** turns a video idea (plus an optional reference video) into
professional, scene-by-scene **image & video prompts** — ready for Veo, Sora,
Runway, Kling and Midjourney — with dialogue in the viewer's chosen language.

Branded workspace in the spirit of chat.z.ai: a sidebar with generation
history, a centered greeting with a single composer, and a thread view where
each scene arrives as a copyable card.

---

## Product decisions baked in

- **Guest-first funnel** — everyone lands directly in the tool. Accounts are
  required to *use* it: the moment a guest tries to generate or attach a
  video, a light top notification bar appears ("Sign in to start
  generating"); their idea is kept and auto-runs right after sign-in.
- **1–8 scenes per generation**, each scene 4–12 seconds, user-selected.
- **Prompt languages are admin-managed** (seeded: EN, AR, FR, ES, DE, PT, TR).
  The UI itself is English; generated prompts/dialogue follow the picked language.
- **Full reference-video analysis** — videos are uploaded to the Gemini Files
  API and analyzed for style, grading, camera movement and pacing.
- **Stripe from day one** — subscription checkout + customer portal + signed
  webhooks, honestly gated until keys are configured.
- **Theme follows the device** (system by default) with manual override;
  warm-paper light theme and deep-cocoa dark theme in brand colors
  `#270c00 / #ef780d / #000000`, Montserrat everywhere.

## Domain plan

| Domain | Purpose |
|---|---|
| `chafiktech.com` | Marketing site (planned — later) |
| `prompt.chafiktech.com` | **This app** |
| `blog.chafiktech.com` | Blog (planned — later) |

Deployment instructions for **Vercel** and **VPS (Nginx + PM2 + Certbot)**,
including DNS records, live in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Quick start (local)

```bash
npm install
npx prisma generate && npx prisma db push
cp .env.example .env          # defaults work out of the box
bun scripts/seed.ts           # or: npx tsx scripts/seed.ts
npm run dev                   # http://localhost:3000
```

Seeded admin: **admin@chafiktech.com / ChafikTech@2026**
(change it immediately in production — Settings → Account).

## First run in 60 seconds

1. Open the app — you land straight in the tool as a guest.
2. Type an idea, pick scene count + dialogue language, press Generate →
   the sign-in bar appears; sign in (or create an account) and your idea
   auto-submits.
3. Admin account → avatar menu → **Admin panel** → *Gemini Keys* → add a key
   → **Test**. Generations now run end-to-end.
4. *Plans* tab controls quotas/prices; *Prompt Languages* controls output
   languages; *Users* manages plans, bans and roles.

## Feature map

| Area | Where |
|---|---|
| Workspace (history, composer, thread, exports, share) | `src/components/chafiktech/workspace.tsx` |
| Composer (video attach, scenes popover, language select) | `src/components/chafiktech/composer.tsx` |
| Scene cards (auto-RTL dialogue, per-field copy) | `src/components/chafiktech/scene-card.tsx` |
| Auth (email + Google, reset, verify) | `src/components/chafiktech/auth-view.tsx` + `src/app/api/auth/*` |
| Pricing & Stripe | `src/components/chafiktech/pricing-view.tsx`, `src/app/api/billing/*`, `src/app/api/stripe/webhook` |
| Admin panel (6 tabs) | `src/components/chafiktech/admin-view.tsx` + `src/app/api/admin/*` |
| Gemini pipeline (Files API, rotation, validation) | `src/lib/gemini.ts`, `src/lib/pipeline.ts` |
| Quota, settings/flags, sessions | `src/lib/quota.ts`, `src/lib/settings.ts`, `src/lib/auth.ts` |

## API overview (all JSON, session-cookie auth)

- `POST /api/auth/{signup,signin,signout}` · `GET /api/auth/me` ·
  `POST /api/auth/{forgot,reset,verify,resend}` · `GET /api/auth/google[/callback]`
- `GET|POST /api/projects` · `GET|PATCH|DELETE /api/projects/[id]` ·
  `POST /api/projects/[id]/share`
- `POST|DELETE /api/upload` (signature-sniffed MP4/MOV/WebM)
- `GET /api/plans` · `POST /api/billing/{checkout,portal}` ·
  `POST /api/stripe/webhook` (idempotent)
- `GET /api/admin/{stats,plans,keys,languages,users,settings}` (+ mutations)
- `GET /api/share/[token]` — public read-only share

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 + shadcn/ui ·
Prisma + SQLite · next-themes · Sonner · Stripe REST · Gemini API.
Logo: drop your real file at `public/brand-logo.png` — it replaces the
placeholder film-reel mark everywhere automatically.
