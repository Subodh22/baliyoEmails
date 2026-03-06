# Baliyo Emails

Cold email outreach platform. Monorepo with a Next.js frontend, Express API, BullMQ workers, Prisma + PostgreSQL, Redis, and AWS SES for sending.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, Tailwind, Radix UI, TanStack Query |
| Backend | Express, Zod, BullMQ workers |
| Database | PostgreSQL via Supabase + Prisma |
| Queue | Redis (local) or Upstash (production) |
| Auth | Clerk |
| Email sending | AWS SES |
| Billing | Stripe |
| Monitoring | Sentry |

---

## Prerequisites

- Node.js >= 18
- npm >= 9
- Docker (for local Redis)
- AWS account with SES configured
- Supabase project
- Clerk account
- Stripe account (optional for billing)

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd baliyoemails
npm install
```

---

## 2. Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Fill in each value:

```env
# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
DATABASE_URL=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres

# ── Redis ─────────────────────────────────────────────────────────────────────
# Local development (Docker):
REDIS_URL=redis://localhost:6379

# Production (Upstash):
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ── AWS SES ───────────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=<iam-access-key>
AWS_SECRET_ACCESS_KEY=<iam-secret-key>
AWS_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@yourdomain.com

# ── Clerk ─────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_FREE_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_AGENCY_PRICE_ID=

# ── Sentry (optional) ─────────────────────────────────────────────────────────
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:4000
TRACKING_DOMAIN=track.localhost
JWT_SECRET=change-me-in-production-32-chars-min
NODE_ENV=development
PORT=4000
```

---

## 3. Start Local Redis

```bash
docker compose up redis -d
```

---

## 4. Database Setup

Generate the Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

To open Prisma Studio (database GUI):

```bash
npm run db:studio
```

---

## 5. Run Development Servers

`npm run dev` starts the API and web app via Turborepo. **The worker must be started separately** in a second terminal.

**Terminal 1 — API + Web:**
```bash
npm run dev
```

**Terminal 2 — Background workers (email sending, reply detection, bounce processing):**
```bash
cd apps/api && npx tsx watch src/worker.ts
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API | http://localhost:4000 |
| Worker | (background process, no port) |

> The worker runs 4 BullMQ workers: `email-send`, `sequence-scheduler`, `reply-detector`, `bounce-processor`.
> Without it, campaigns will queue up jobs but emails will never be sent.

---

## 6. AWS SES Setup

### Step 1 — Verify your sending domain

1. Go to **AWS Console → SES → Verified identities → Create identity**
2. Choose **Domain**, enter your domain (e.g. `yourdomain.com`)
3. AWS will show you DNS records to add

### Step 2 — Add DNS records in your DNS provider (e.g. GoDaddy)

Add the following records:

**3x CNAME (DKIM)** — AWS provides the exact values, format is:
| Type | Name | Value |
|------|------|-------|
| CNAME | `<token>._domainkey` | `<token>.dkim.amazonses.com` |
| CNAME | `<token>._domainkey` | `<token>.dkim.amazonses.com` |
| CNAME | `<token>._domainkey` | `<token>.dkim.amazonses.com` |

**SPF TXT record:**
| Type | Name | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 include:amazonses.com ~all` |

**DMARC TXT record:**
| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

> DNS propagation takes 5–30 minutes. SES will auto-detect once propagated.

### Step 3 — Create IAM credentials

1. Go to **AWS Console → IAM → Users → Create user**
2. Attach policy: **AmazonSESFullAccess**
3. Go to **Security credentials → Create access key**
4. Copy the **Access Key ID** and **Secret Access Key** into your `.env`

### Step 4 — Request production access

By default SES is in **sandbox mode** (can only send to verified emails).

To send to anyone:
1. Go to **SES → Account dashboard**
2. Click **Request production access**
3. Fill in the form — AWS usually approves within 24 hours

---

## 7. Connect a Sending Account

Once SES is verified, add it as a sending account via the API or the UI:

```bash
curl -X POST http://localhost:4000/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "email": "noreply@yourdomain.com",
    "name": "Main SES Account",
    "type": "ses",
    "sesRegion": "us-east-1",
    "dailyLimit": 200
  }'
```

Leave `sesAccessKeyId` and `sesSecretKey` out to use the `AWS_*` env vars. Or pass them explicitly per account for multi-account setups.

---

## 8. SES Bounce Webhooks (SNS)

To automatically handle bounces and complaints:

1. Go to **AWS Console → SNS → Create topic** (Standard type), name it `ses-bounces`
2. Go to **SES → Verified identities → your domain → Notifications**
3. Set **Bounce** and **Complaint** notifications to your SNS topic
4. In SNS, create a **Subscription**: Protocol = HTTPS, Endpoint = `https://yourapi.com/api/webhooks/ses`
5. AWS will send a confirmation request — the app auto-confirms it

---

## 9. Production with Docker

Build and run all services:

```bash
docker compose up --build
```

Services started:
- `web` on port 3000
- `api` on port 4000
- `worker` (background email/queue processor)
- `redis` on port 6379

---

## Project Structure

```
baliyoemails/
├── apps/
│   ├── api/          # Express API server
│   │   ├── src/
│   │   │   ├── routes/       # campaigns, sequences, leads, accounts, domains, analytics, inbox, billing, webhooks
│   │   │   ├── middleware/   # auth
│   │   │   ├── index.ts      # API entry point
│   │   │   └── worker.ts     # Worker entry point
│   │   ├── Dockerfile
│   │   └── Dockerfile.worker
│   └── web/          # Next.js frontend
│       └── src/
│           ├── app/          # Pages (campaigns, sequences, leads, inbox, analytics, settings)
│           ├── components/   # UI components
│           └── store/        # Zustand state
├── packages/
│   ├── db/           # Prisma schema and client
│   ├── queue/        # BullMQ queues and workers
│   │   └── src/workers/
│   │       ├── email-send.ts         # Sends emails via SMTP or SES
│   │       ├── sequence-scheduler.ts # Schedules next steps
│   │       ├── reply-detector.ts     # IMAP reply polling
│   │       └── bounce-processor.ts   # Processes SES bounces
│   └── types/        # Shared TypeScript types
├── docker-compose.yml
├── turbo.json
└── .env.example
```

---

## Common Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start API + web in dev mode (Terminal 1) |
| `cd apps/api && npx tsx watch src/worker.ts` | Start background workers (Terminal 2) |
| `npm run build` | Build all packages |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |
| `docker compose up redis -d` | Start Redis locally |
| `docker compose up --build` | Run full stack in Docker |
