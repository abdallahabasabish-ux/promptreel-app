# CHAFIKTECH — Deployment & Domains Guide

This guide covers the full domain architecture for the CHAFIKTECH brand and two
hosting paths for the tool. Pick **one** path; both end with the same result.

---

## 1. Domain architecture (the plan)

The final name of the website is **CHAFIKTECH**. One root domain, three purposes:

| Domain | Purpose | Status |
|---|---|---|
| `chafiktech.com` | **Marketing site** (landing page, product info) | planned — later |
| `prompt.chafiktech.com` | **This app** — the AI video prompt generator | deploy now |
| `blog.chafiktech.com` | **Blog** (articles about prompting) | planned — later |

### DNS records to create at your registrar (Namecheap, Hostinger, Cloudflare…)

| Type | Name | Value | Notes |
|---|---|---|---|
| `A` | `@` | your server IP *(or Vercel value)* | for the future marketing site |
| `CNAME` | `prompt` | see hosting path below | the tool — needed now |
| `CNAME` | `blog` | see hosting path below | only when the blog ships |

> Tip: if you use Cloudflare, create the records with the proxy **off** (grey
> cloud) first, verify SSL works, then enable proxy if you want.

Nothing in the codebase needs to change per subdomain — Stripe callbacks,
Google OAuth and share links all follow the incoming request origin. The only
relevant env var is `NEXT_PUBLIC_APP_URL` (used for metadata/OG tags).

---

## 2. Environment variables (production)

```env
NEXT_PUBLIC_APP_URL=https://prompt.chafiktech.com
DATABASE_URL=file:/absolute/path/on/persistent/disk/chafiktech.db

# optional integrations (gracefully disabled until set)
GEMINI_API_KEY=            # fallback only; manage keys in Admin → Gemini Keys
STRIPE_SECRET_KEY=         # enables card payments
STRIPE_WEBHOOK_SECRET=     # enables subscription sync via webhooks
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=      # redirect URI: https://prompt.chafiktech.com/api/auth/google/callback
SMTP_HOST=  SMTP_PORT=587  SMTP_USER=  SMTP_PASS=
SMTP_FROM="CHAFIKTECH <no-reply@chafiktech.com>"

ADMIN_EMAIL=admin@chafiktech.com
ADMIN_PASSWORD=<change-me-before-first-boot>
```

---

## 3. Path A — Vercel (fastest, good for trials & small teams)

1. Push the repository to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New Project** → import the repo
   (framework auto-detected: Next.js).
3. Add environment variables from section 2. For the SQLite `DATABASE_URL`,
   use `/tmp/chafiktech.db` if you just want to try it out.
4. Deploy, then **Settings → Domains → Add**: `prompt.chafiktech.com`.
5. Create the DNS record it shows you — normally:
   `CNAME  prompt  cname.vercel-dns.com`
   (apex `chafiktech.com` → `A 76.76.21.21` for the future marketing site.)
6. SSL is issued automatically.

> **⚠ Honest limitation — read before using Vercel in production:**
> This project ships with **SQLite** (a file on disk) and **local video uploads**.
> Vercel's serverless filesystem is **ephemeral**: every deploy resets the
> database, and uploaded reference videos disappear between invocations.
> Vercel is perfect for demos and trials, but for a paying product either:
> - use **Path B (VPS)** — everything works as-is, **or**
> - migrate the app to Postgres (Prisma provider swap) + object storage
>   (S3/R2) for uploads before selling plans on Vercel.

---

## 4. Path B — VPS (Hostinger VPS, Contabo, Hetzner… — recommended)

Works with the existing SQLite + local uploads architecture unchanged.

### 4.1 Server prep (Ubuntu 22.04/24.04)

```bash
# Node.js 20 + PM2 + Nginx + Certbot
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo npm i -g pm2

# Bun (for prisma scripts) — optional but recommended
curl -fsSL https://bun.sh/install | bash
```

### 4.2 App

```bash
sudo mkdir -p /var/www/chafiktech && sudo chown $USER /var/www/chafiktech
cd /var/www/chafiktech
git clone <your-repo-url> .
npm install
npx prisma generate && npx prisma db push
npm run build            # runs next build + copies static/public into standalone
cp .env.example .env && nano .env   # fill section 2 (DATABASE_URL → /var/www/chafiktech/db/chafiktech.db)
```

Seed the database once, then start under PM2:

```bash
bun scripts/seed.ts          # or: npx tsx scripts/seed.ts
pm2 start ".next/standalone/server.js" --name chafiktech \
  --env NODE_ENV=production -- --port 3000
pm2 save && pm2 startup
```

### 4.3 Nginx — one server block per subdomain

`/etc/nginx/sites-available/chafiktech`:

```nginx
# ── THE TOOL ────────────────────────────────────────────────
server {
    listen 80;
    server_name prompt.chafiktech.com;

    client_max_body_size 1100M;   # reference videos up to 1 GB on Studio plan

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;  # Gemini generation can take ~1 min
    }
}

# ── MARKETING SITE (later) ─────────────────────────────────
# server {
#     listen 80;
#     server_name chafiktech.com www.chafiktech.com;
#     root /var/www/chafiktech-marketing;
#     index index.html;
#     location / { try_files $uri $uri/ =404; }
# }

# ── BLOG (later) ───────────────────────────────────────────
# server {
#     listen 80;
#     server_name blog.chafiktech.com;
#     ...same proxy or static root as needed...
# }
```

```bash
sudo ln -s /etc/nginx/sites-available/chafiktech /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4.4 Free SSL (Let's Encrypt) — per subdomain

```bash
sudo certbot --nginx -d prompt.chafiktech.com
# later: sudo certbot --nginx -d chafiktech.com -d www.chafiktech.com -d blog.chafiktech.com
sudo certbot renew --dry-run   # auto-renewal check
```

### 4.5 Updates

```bash
cd /var/www/chafiktech && git pull && npm install && npx prisma db push && npm run build
pm2 restart chafiktech
```

---

## 5. Stripe webhook (when billing goes live)

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
   `https://prompt.chafiktech.com/api/stripe/webhook`
2. Subscribe to: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and restart.

## 6. Post-deploy checklist

- [ ] Sign in as admin and **change the admin password** (Settings → Account).
- [ ] Admin → Gemini Keys → add a real key → press **Test** (badge turns *valid*).
- [ ] Make a real generation end-to-end (idea + optional reference video).
- [ ] Set `NEXT_PUBLIC_APP_URL` and confirm share links + OG tags use the subdomain.
- [ ] If using Stripe: one real checkout with a test card, then switch to live keys.
- [ ] If using Google OAuth: add the callback URL in Google Cloud Console.
- [ ] Uptime/monitor + nightly `sqlite3 ... ".backup"` cron on a VPS.
