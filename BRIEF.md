# WhatsApp Sticker Print Service — Project Brief

A web service that turns stickers from someone's WhatsApp library into physical printed stickers, mailed to them. MVP for the Israeli market. This document is the source of truth for architecture and decisions; update it as things evolve.

## How users experience it

1. Visit `stickers.wallaura.art`, enter their phone number.
2. Either upload a sticker file directly, or send a sticker to the service's WhatsApp number from the same phone.
3. See a print mockup with size, cut type (kiss-cut / rectangle), and quantity options.
4. Enter shipping address, pay via PayPlus.
5. Receive shipping notifications via WhatsApp + email.
6. Sticker arrives in 7–14 days.

WhatsApp is exclusively an alternative image input — every other step happens on web. This is deliberate: it keeps WhatsApp out of the critical path while preserving the product wedge (printing *actual WhatsApp stickers*, not arbitrary images, since they're otherwise hard to extract from the WhatsApp app).

## Architecture overview

```
[ WhatsApp Cloud API ]   [ PayPlus ]   [ Printful ]   [ Resend ]
        ↕                    ↕              ↕             ↑
        ↓                    ↓              ↓             │
        └──────────── stickers.wallaura.art ──────────────────┘
                       (Next.js on Vercel)
                              ↕
                  ┌───────── Supabase ─────────┐
                  │  Postgres │ Storage │ Realtime │
                  └────────────────────────────┘
```

External services on top, our app in the middle, Supabase as backend. Every external integration is replaceable — Printful → local print shop, PayPlus → Stripe, Supabase → self-host — without touching the user-facing layer.

## Stack

- **Frontend + Backend**: Next.js 16 (App Router) on Vercel
- **Domain**: `stickers.wallaura.art` (subdomain of an existing PayPlus-approved root)
- **Database / Storage / Realtime**: Supabase
- **Payment**: PayPlus (existing account, hosted page flow)
- **Print fulfillment**: Printful API (V2 REST)
- **Email**: Resend
- **WhatsApp**: Green API (managed WhatsApp Web gateway) for MVP; migrate to Meta Cloud API once volume or ban risk justifies
- **Image processing**: `sharp` on Vercel Node runtime; optionally Real-ESRGAN for upscaling

## Why these choices (and the trade-offs)

**Vercel + Supabase + Next.js.** Same stack already proven on trainer-booking and HitQuote. Free tiers cover the MVP entirely.

**Printful for fulfillment.** Free signup, self-serve API tokens (no sales call), sandbox environment, stickers as a first-class catalog category with kiss-cut and custom border options, V2 REST API with proper webhooks. Trade-off: 7–12 day shipping from EU production hubs vs 1–3 days from a local Israeli print shop. Accepted for MVP simplicity. Swap later without touching user-facing code.

**Subdomain on existing domain (PayPlus reuse).** PayPlus typically approves at the registered-domain level; subdomains usually inherit coverage. **Verify this in step 1 of build sequence below** — if the account turns out to be locked to bare domain, fall back to `wallaura.art/stickers/*` via a Vercel rewrite.

**Green API for WhatsApp (MVP), with migration path to Cloud API.** Cloud API is the official, ban-safe path but takes 1–3 weeks of Meta Business verification and locks the phone number into WABA permanently. Green API is a managed gateway over the WhatsApp Web protocol (similar to Baileys but hosted) — setup in under an hour, scan a QR code with the phone, webhooks delivered like any HTTP service. The trade-off is real: it's technically against WhatsApp ToS and the number *can* be banned, though rare for transactional low-volume use. The architecture treats WhatsApp as a swappable input, so migrating to Cloud API later is a webhook-handler swap and a number transfer — no user-facing changes.

## Data model

```sql
-- Open sessions waiting for an image (or being configured / paid)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  status text not null default 'awaiting_image',
    -- awaiting_image | image_received | configuring | paid | abandoned | expired
  image_url text,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '60 minutes'
);
create index sessions_phone_status on sessions (phone_e164, status);

-- Orders are sessions that converted
create table orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  phone_e164 text not null,
  email text,

  image_url text not null,             -- original (raw from WhatsApp / upload)
  print_image_url text not null,       -- post-processed, print-ready PNG

  size_mm int not null,                -- 50, 70, 100
  cut_type text not null,              -- 'kiss_cut' | 'rectangle'
  quantity int not null,
  shipping_address jsonb not null,

  product_cost_agorot int not null,
  shipping_cost_agorot int not null,
  total_agorot int not null,

  payplus_transaction_id text,
  paid_at timestamptz,

  printful_order_id text,
  printful_status text,
  shipped_at timestamptz,
  tracking_url text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index orders_phone on orders (phone_e164);
create index orders_printful on orders (printful_order_id);

-- Inbound WhatsApp images we couldn't immediately match (~15 min TTL)
create table whatsapp_orphans (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  image_url text not null,
  whatsapp_message_id text not null,
  received_at timestamptz default now(),
  expires_at timestamptz default now() + interval '15 minutes',
  matched_to_session_id uuid references sessions(id)
);
```

## API routes

```
POST  /api/sessions                    Create session, returns { id, whatsapp_deep_link }
GET   /api/sessions/:id                Get session state (configurator polls / subscribes)
POST  /api/sessions/:id/upload         Direct upload path
PATCH /api/sessions/:id                Update config (size, qty, cut, address)
POST  /api/sessions/:id/checkout       Create PayPlus payment page, return URL

POST  /api/webhooks/whatsapp           Green API (MVP) / Meta Cloud API webhook
POST  /api/webhooks/payplus            PayPlus IPN
POST  /api/webhooks/printful           Printful order status webhook

POST  /api/cron/cleanup                Vercel Cron: expire stale sessions, orphans
```

## Integrations

### WhatsApp — Green API (MVP)
- Sign up at green-api.com, create an instance, scan QR with the service phone
- Configure webhook URL in instance settings to `/api/webhooks/whatsapp`
- Inbound `incomingMessageReceived` events arrive as JSON; media URLs are signed and downloadable directly
- Outbound: `POST /waInstance{id}/sendMessage/{token}` and `sendFileByUrl` for media
- No template approval, no message-type restrictions — service messages and notifications use the same API
- Risk: number ban if WhatsApp detects bot patterns. Mitigations: low message volume, human-shaped delays, no bulk sends, keep number warm with normal use

### WhatsApp — Meta Cloud API (post-MVP migration)
- Provision a WhatsApp Business number through Meta Business Manager (1–3 weeks verification)
- Configure webhook to `/api/webhooks/whatsapp` with verification token
- Subscribe to `messages` events
- Download incoming media via Graph API: `GET /v18.0/{media_id}` then fetch the URL it returns; upload to Supabase Storage
- Outbound notifications use approved template messages (~$0.005–0.01 each in IL)
- Service messages (replies within 24 h of user message) are free
- For the wa.me deep-link button on web: `wa.me/{number}?text=...`

### PayPlus
- Use existing account
- Hosted Payment Page flow: POST to PayPlus to create a payment page, redirect user to returned URL
- IPN handler: **verify HMAC signature on every callback**. Their signing scheme has changed before — check current docs at implementation time
- On successful transaction: mark order paid, queue Printful order creation

### Printful
- Sign up at printful.com; generate a Private Token in the Developer Portal
- Auth: `Authorization: Bearer {token}`
- Create order: `POST https://api.printful.com/v2/orders`
- Sticker variant IDs: query the catalog endpoint; kiss-cut sticker has options for size and `custom_border_color`
- Print file: pass a publicly accessible URL (Supabase Storage signed URL works)
- Webhooks: subscribe to `package_shipped`, `package_returned`, `order_canceled`
- Test in sandbox before flipping to production token

### Resend
- API key + verified sending domain
- Transactional templates: order confirmation, shipped, delivered
- Free tier: 3,000/month, 100/day — sufficient for MVP

### Supabase
- Storage bucket `stickers` with RLS: read via signed URL only, write via service role
- Realtime publication on `sessions` table
- Service role key only in Vercel env (server-side); never in client bundle

## Implementation notes

### Vercel runtime
sharp ships native binaries — webhook and image-processing routes must use **Node runtime**, not Edge:
```typescript
export const runtime = 'nodejs';
```

### Animated WhatsApp stickers
Many WhatsApp stickers are multi-frame .webp animations. Printful expects a static image. Extract frame 0 with sharp before sending to print:
```typescript
const buf = await sharp(input, { animated: false }).png().toBuffer();
```

### Resolution and print size
WhatsApp stickers are 512×512 max. At 300 DPI that limits print to ~4 cm. Either cap size at 5 cm and accept it, or upscale via Real-ESRGAN / clipdrop before printing. Cost of upscale is ~₪1–2/sticker — bake into pricing.

### Realtime push from WhatsApp ingestion to web
The "waiting for sticker" page subscribes to its session row. When the WhatsApp webhook flips `image_url`, the page reacts:
```typescript
const channel = supabase
  .channel(`session:${sessionId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'sessions',
    filter: `id=eq.${sessionId}`
  }, payload => {
    if (payload.new.image_url) {
      // Move to configurator
    }
  })
  .subscribe();
```

### WhatsApp matching logic
On incoming WhatsApp message:
1. Normalize sender phone to E.164
2. Find open session: `status = 'awaiting_image' AND phone_e164 = ? AND expires_at > now()`
3. Match found → download media, upload to Storage, set `image_url`, advance status
4. No match → insert into `whatsapp_orphans` (15-min TTL). When a session opens, sweep orphans by phone
5. Phone mismatch (user typed different number than they sent from) → reply on WhatsApp: "send from this number: +972…"

### Webhook reply timing
PayPlus IPN and Printful webhooks both expect 200 within 10 seconds. Heavy work (creating Printful orders, processing images) goes to a queue table read by Vercel Cron, not done synchronously in the webhook handler.

### Vercel Cron
- `/api/cron/cleanup` runs every 5 minutes
- Expires stale sessions, deletes orphans past TTL
- Configure in `vercel.json`

## Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# WhatsApp — Green API (MVP)
GREEN_API_INSTANCE_ID=
GREEN_API_TOKEN=
GREEN_API_WEBHOOK_SECRET=

# WhatsApp — Meta Cloud API (post-migration; unset for MVP)
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_VERIFY_TOKEN=
META_WHATSAPP_APP_SECRET=

# PayPlus
PAYPLUS_API_KEY=
PAYPLUS_SECRET_KEY=
PAYPLUS_HMAC_SECRET=

# Printful
PRINTFUL_PRIVATE_TOKEN=
PRINTFUL_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=

# App
APP_URL=https://stickers.wallaura.art
```

## Build sequence

Each step produces a testable milestone. Don't move on until the current one works.

1. **Vercel + domain proof.** Deploy a hello-world Next.js to `stickers.wallaura.art`, run a real ₪1 PayPlus test transaction. This de-risks the subdomain decision before you build anything else — it's the one thing that could force a refactor.
2. **Supabase + schema.** Apply migrations above, set up Storage bucket, enable Realtime publication on `sessions`.
3. **Web-only flow.** Hebrew RTL configurator UI, direct upload path, address form, PayPlus checkout, order confirmation page. At the end of this step, the product ships orders without WhatsApp at all.
4. **WhatsApp ingestion.** Green API instance setup, webhook handler, phone-based matching, Realtime push to the waiting page.
5. **Printful integration.** Sandbox order creation, webhook handling, status updates on the order row.
6. **Notifications.** Resend transactional emails. WhatsApp messages for shipped / delivered (free-form via Green API for MVP).
7. **Production cutover.** Live API tokens, end-to-end test with a 5 cm kiss-cut sticker on a real order.

## MVP scope

**In:**
- Static stickers from WhatsApp library (frame 0 of animated extracted automatically)
- Direct upload alternative
- Three sticker sizes: 5 cm, 7 cm, 10 cm
- Two cut types: kiss-cut, rectangle
- Quantities 1–50
- Israel shipping only
- Hebrew + English UI

**Out (v1.1+):**
- Multi-design sticker sheets
- Animated stickers (lenticular print is exotic and costly)
- Custom shapes beyond Printful defaults
- Holographic / metallic finishes
- B2B bulk orders
- Subscriptions / sticker packs

## Open decisions

- Final domain choice (`stickers.wallaura.art` vs alternate)
- Pricing model: cost-plus markup vs fixed prices per size
- Upscaling strategy: skip / clipdrop / Real-ESRGAN dedicated
- Brand voice for Hebrew WhatsApp messages: formal vs casual
- Logo / visual identity timing

## What this brief is, and isn't

This is the architecture landed on after design conversations. It assumes the product wedge is "print my WhatsApp sticker" — if the scope expands (custom designs, sticker sheets, B2B), revisit choices like Printful as the fulfillment partner. Intentionally MVP-shaped: every external service is replaceable; the boring core (Next.js + Postgres) is built to last.
