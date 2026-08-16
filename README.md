# Argent

Import an OpenAPI (Swagger) document — or connect PostgreSQL, MariaDB or
ClickHouse — and turn your existing backend APIs into **hosted MCP servers** for
AI clients, plus dashboards (tables, charts, KPI cards and forms) without
writing application code.

Every upstream call goes through a server-side gateway, so credentials are
stored encrypted and never reach the browser or MCP clients, and CORS never
comes up.

<p align="center">
  <img src="docs/screenshots/landing.jpg" alt="Argent landing page" width="800" />
  <br /><em>Landing</em>
</p>

<p align="center">
  <img src="docs/screenshots/home.png" alt="Argent home after sign-in" width="800" />
  <br /><em>Home after sign-in</em>
</p>

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Campaign performance demo dashboard" width="800" />
  <br /><em>Demo dashboard — Campaign performance</em>
</p>

## What it does

| Area                | What you get                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **MCP servers**     | Named tool packs at `/mcp` that mix endpoints from multiple API connections; a sample MCP ships with the bundled demo. |
| **Connections**     | Connect an HTTP API from OpenAPI, or a SQL database (Postgres / MariaDB / ClickHouse). Credentials encrypted; headers for APIs. |
| **Databases**       | Map schemas after connect, write SQL with `{{parameters}}`, save queries, build objects from the rows. |
| **API Explorer**    | Every endpoint grouped by tag, with a "Try it" runner and per-endpoint success rate.                 |
| **Objects**         | Turn an endpoint or SQL query into a table, chart, KPI card, form or action button, with a live preview. |
| **Row buttons**     | Give a table a toolbar per row — view, edit, delete, or any endpoint — each opening a pop-up.        |
| **Dashboards**      | Drag-and-resize grid, dashboard-wide filters, and row selection that feeds an edit form.             |
| **Help & Docs**     | Guides on APIs, OpenAPI, and MCP, plus reference pages from your specs.                                |
| **Request Builder** | A Postman-style editor for endpoints your spec does not cover. Saved requests become objects too.    |

## Requirements

- Node.js 20 or newer
- PostgreSQL 16 (Docker Compose file included)

## Getting started

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Configure the environment
cp .env.example .env
node -e "console.log('APP_MASTER_KEY=\"' + require('crypto').randomBytes(32).toString('base64') + '\"')" >> .env

# 3. Install and set up the database
npm install
npm run setup      # prisma generate + db push + seed

# 4. Run it
npm run dev
```

Open http://localhost:3000. On first visit you will be asked to **create an
admin account** (email + password). After that, protected routes require a
signed session cookie. Public routes include `/`, `/login`, `/signup`,
`/forgot-password`, `/reset-password`, `/verify-email`, and the demo mock API.

Public sign-up sends an email verification link (via Resend). Until the user
opens that link, sign-in is blocked. Without `RESEND_API_KEY` in development,
the link is shown once in the UI instead.

`npm run setup` seeds default roles (Admin, Dev, Sales, Client) with section
grants, plus a demo connection from `fixtures/demo.yaml` and a sample
dashboard. You can also install the demo from the home page with **Load the
example**, and remove it again by deleting the connection.

### About the demo

`fixtures/demo.yaml` describes a sample affiliate API: 32 endpoints across
Accounts, Account Groups, Campaigns, Campaign Groups, Stats and Commission
Reports, authenticated with `apiu` and `apik` query parameters.

Its base URL points at `/api/demo`, a mock implementation that ships with Argent
(`src/server/demo/data.ts`), so the whole flow — import, credentials, gateway,
charts, editing — works offline against generated but stable figures. Writes are
enabled on the demo connection because the mock API is a local sandbox; real
connections start read-only.

Set `DEMO_API_BASE_URL` before seeding to point the same spec at a real server.

### Sample MCP (`sample`)

Loading the demo also creates a hosted MCP server at `/api/mcp/sample`
with curated read tools (`listAccounts`, `getAccount`, `listCampaigns`,
`getStatsSummary`, …). Mint a token under **MCP → Sample MCP**, then add
it to Cursor / Claude:

```json
{
  "mcpServers": {
    "argent-sample": {
      "url": "http://localhost:3000/api/mcp/sample",
      "headers": {
        "Authorization": "Bearer argent_mcp_YOUR_TOKEN"
      }
    }
  }
}
```

Example prompts once connected:

- “Using the sample MCP, list all affiliate accounts and summarize how many there are.”
- “Call getAccount with id 1 and tell me the account name and status.”
- “Fetch getStatsSummary and getDailyStats, then explain whether performance is trending up or down.”

The sample MCP page in the app shows copyable prompts and tool-call examples.

### Using your own PostgreSQL

If you already run PostgreSQL locally, skip `docker compose` and point
`DATABASE_URL` at your instance:

```
DATABASE_URL="postgresql://user:password@localhost:5432/seeit?schema=public"
```

## Configuration

| Variable                | Required | Purpose                                                                       |
| ----------------------- | -------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`          | yes      | PostgreSQL connection string.                                                  |
| `APP_MASTER_KEY`        | yes      | Base64 32-byte key for AES-256-GCM encryption of upstream credentials.         |
| `SESSION_SECRET`        | recommended | Signs the `argent_session` login cookie. Falls back to `APP_MASTER_KEY` if empty. |
| `GATEWAY_ALLOWED_HOSTS` | no*      | Comma-separated hostname allowlist for HTTP *and* database hosts. Empty = any (dev). *Required in any shared/public deploy. |
| `APP_URL`               | yes in prod | Public origin for demo mock URL + verification / password-reset links.      |
| `RESEND_API_KEY`        | yes in prod | Resend API key for verification and password-reset email.                   |
| `EMAIL_FROM`            | recommended | From address, e.g. `Argent <noreply@yourdomain.com>` (verified domain).      |
| `ALLOW_PUBLIC_SIGNUP`   | no       | Public `/signup` (default on). Set `false` to require admin-created users.     |
| `SIGNUP_DEFAULT_ROLE`   | no       | Role for public sign-ups: `client` (default), `sales`, or `dev` (never admin). |
| `DEMO_API_BASE_URL`     | no       | Override the demo connection's base URL to aim the bundled spec elsewhere.     |

### Login, roles, and themes

- **Sign-in / sign-up:** email + password (bcrypt). Session is an httpOnly cookie
  signed with `jose` (`SESSION_SECRET` / `APP_MASTER_KEY`). Public sign-ups must
  verify email (`/verify-email`) before they can sign in. Bootstrap admin and
  admin-created users are marked verified immediately. After first sign-in, new
  accounts go through `/onboarding`. Admin-created users are flagged to set a
  new password on first login.
- **Forgot password:** `/forgot-password` emails a one-hour reset link via Resend
  (`APP_URL` must be correct). In development without `RESEND_API_KEY`, the link
  is shown once on screen.
- **Roles:** Admin (all sections including **Users**), Dev (all except Users),
  Sales (Dashboards, Objects, Docs), Client (Dashboards, Docs). Admins can
  change role section grants and per-user overrides under **Users**.
- **Dashboard viewers:** empty “Who can view” means anyone with the Dashboards
  section; once any role/user is listed, only those (plus Admin) can open it.
- **Appearance:** Light, Dark, System, Soft light, and High contrast. Preference
  is stored on the user (and in `localStorage` before login). Pick it from the
  sidebar user menu or **Settings**.

Changing `APP_MASTER_KEY` makes existing stored credentials unreadable; you will
be prompted to re-enter them.

## Deploying on Railway

Argent needs a long-running Node server (gateway, bcrypt, Prisma) and PostgreSQL.
Railway fits that well.

1. Push this repo to GitHub.
2. In Railway: **New Project** → **Add PostgreSQL** → **Deploy from GitHub**
   (this repo). Reference the Postgres `DATABASE_URL` on the web service.
3. Set the web service commands:
   - **Build:** `npm ci && npx prisma generate && npm run build`
   - **Start:** `npx prisma db push && npm run start`
4. Set environment variables on the web service:

   | Variable | Notes |
   |----------|--------|
   | `DATABASE_URL` | From the Railway Postgres plugin |
   | `APP_MASTER_KEY` | Fresh 32-byte base64 (do not reuse a leaked local key) |
   | `SESSION_SECRET` | Separate fresh secret |
   | `APP_URL` | Public `https://…` URL (Railway domain or custom) |
   | `GATEWAY_ALLOWED_HOSTS` | Hosts your connections may call |
   | `RESEND_API_KEY` / `EMAIL_FROM` | From [Resend](https://resend.com) (verify a sending domain) |
   | `ALLOW_PUBLIC_SIGNUP` | Optional; `false` to close self-serve sign-up |

5. Create a Resend account, API key, and verified sending domain (or use Resend’s
   onboarding sender only for smoke tests). Set `EMAIL_FROM` accordingly.
6. Open `APP_URL`, create the first admin at `/login`, then smoke-test sign-up
   verification and forgot-password email.

The first deploy uses `prisma db push` (there is no migrations folder yet). For
ongoing schema changes, prefer `prisma migrate` so production stays reproducible.

If you already had users before email verification was added, mark them verified
once (otherwise they cannot sign in):

```bash
npx tsx scripts/backfill-email-verified.ts
```

## How it fits together

```
Browser  ──POST objectId + filters──▶  /api/gateway/execute
                                            │
                                     resolve operation
                                     bind + validate parameters
                                     decrypt credentials
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
             upstream REST API                         SQL via engine adapter
                                                    (pg / mysql2 / clickhouse)
                    │                                               │
                    └─────────── normalize rows + RequestLog ───────┘
                                            │
Browser  ◀──── rows + field descriptors ────┘
```

The browser only ever names an object and its filter values. It never receives
an upstream URL, a header, a SQL password, or a secret.

## Project layout

```
prisma/schema.prisma          Data model
fixtures/demo.yaml            Demo OpenAPI document used by the seed
src/app/                      Routes (App Router)
  api/                        Route handlers, including the gateway
  connections/                Import wizard and connection management
  explorer/                   API explorer and Try-it runner
  objects/                    Object builder and library
  dashboards/                 Dashboard viewer and editor
  requests/                   Postman-style manual request builder
  docs/                       Guides plus generated reference pages
src/server/
  crypto.ts                   AES-256-GCM secret vault
  openapi/                    Spec ingest, normalization, schema inference
  database/                   Postgres / MariaDB / ClickHouse adapters, SQL binder
  gateway/                    Request execution, credential injection, logging
  objects/                    Object suggestion from response schemas
src/components/
  objects/                    Table, chart, KPI, form and action renderers
  builder/                    Object builder UI
  dashboard/                  Grid canvas and filter bar
```

## Scripts

| Script               | Does                                        |
| -------------------- | ------------------------------------------- |
| `npm run dev`        | Start the dev server                        |
| `npm run build`      | Production build                            |
| `npm run typecheck`  | TypeScript, no emit                         |
| `npm run lint`       | ESLint                                      |
| `npm run db:push`    | Sync the schema to the database             |
| `npm run db:seed`    | Load roles + the demo connection and dashboard |
| `npm run db:studio`  | Browse the database in Prisma Studio        |
| `npm run smoke:auth` | Login session, roles, section + dashboard ACL |

## Security notes

- App login uses hashed passwords and a signed httpOnly session cookie. Create
  the first admin at `/login` when no users exist yet. Public sign-ups must
  verify email before sign-in; set `GATEWAY_ALLOWED_HOSTS` and `RESEND_API_KEY`
  before exposing the app publicly.
- Credentials (API keys and database passwords) are encrypted at rest with
  AES-256-GCM and decrypted only inside the gateway process. Connection headers
  marked secret go into the same vault and are masked in previews.
- SQL uses parameterized binds (`$1`, `?`, or ClickHouse `{name:Type}`). Values
  are never string-interpolated into the query.
- Request logs store URLs / SQL previews with secret values replaced by `***`.
- New connections are **read-only**. Non-GET HTTP and non-SELECT SQL are
  refused until you enable writes; destructive actions ask for confirmation.
- Set `GATEWAY_ALLOWED_HOSTS` in any shared deployment. Without it the gateway
  will call any host a connection names, which is convenient in development and
  unwise in production.
