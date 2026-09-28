<h1 align="center">EasyDraw - Server</h1>

<p align="center">
  The API behind accounts, saved documents, private libraries and sketch-to-diagram previews.
</p>

<p align="center">
  <a href="https://easydraw.net"><b>🌐 Live app</b></a>
  &nbsp;·&nbsp;
  <a href="../README.md">📖 Project overview</a>
  &nbsp;·&nbsp;
  <a href="../client/README.md">🎨 Client</a>
</p>

## ℹ️ Overview

A NestJS REST API serving `api.easydraw.net`, backed by PostgreSQL. Its job is
deliberately narrow: authenticate a person, store and return their diagrams and
whiteboards, keep their private image and 3D object libraries, and run the
sketch-to-diagram preview. None of the drawing or 3D logic lives here - the
editors do that work in the browser, which keeps the API fast and the running
cost low.

## 🔌 API surface

**Authentication and sessions**

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account and send a verification email |
| `POST` | `/auth/login` | Sign in, set the session cookie |
| `POST` | `/auth/logout` | End this session |
| `GET` | `/auth/me` | Who is signed in, drives the route guards |
| `GET` | `/auth/google` → `/auth/google/callback` | Google OAuth sign-in |
| `POST` | `/auth/verify-email`, `/auth/resend-verification` | Confirm an address |
| `POST` | `/auth/forgot-password`, `/auth/reset-password` | Send a reset link, then set a new password from it |
| `GET` | `/auth/sessions` | Devices signed in to this account |
| `DELETE` | `/auth/sessions/:id` | Sign one device out |
| `POST` | `/auth/sessions/revoke-others` | Sign out every other device |
| `DELETE` | `/auth/account` | Delete the account and everything in it |

**Documents** - diagrams and whiteboards; every route is scoped to the signed-in owner.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/diagrams` | List the dashboard |
| `POST` | `/diagrams` | Create |
| `GET` | `/diagrams/:id` | Open one |
| `PATCH` | `/diagrams/:id` | Save title, status, category and contents |
| `DELETE` | `/diagrams/:id` | Delete |
| `GET`, `PATCH` | `/diagrams/:id/thumbnail` | Read or store the dashboard picture |
| `GET` | `/templates` | Templates to start from; `POST /templates/:id/use` copies one |

**Private libraries**

| Method | Route | Purpose |
| --- | --- | --- |
| `GET`, `POST`, `PATCH`, `DELETE` | `/node-library/sections…` | The owner's libraries |
| `POST` | `/node-library/sections/:id/uploads` → `/node-library/uploads/:id/complete` | Upload an image straight to storage, then validate and publish it |
| `POST` | `/node-library/assets/resolve` | Short-lived links to draw the owner's images |
| `GET`, `POST`, `PATCH`, `DELETE` | `/object-library/objects…` | Reusable 3D object recipes |

**Sketch to diagram**

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/diagrams/:id/previews` | Ask for a preview of a frozen whiteboard (and optional note) |
| `GET`, `DELETE` | `/diagrams/:id/previews/requests/:requestId` | Follow or cancel that request |
| `GET` | `/diagram-previews/:id` | Read a preview |
| `POST` | `/diagram-previews/:id/commit` | Create the editable diagram from exactly that preview |

`GET /health` reports readiness. An interactive Swagger reference is generated
from the code in development.

## 🗃️ Data model

Sixteen tables, in four groups:

| Group | Tables |
| --- | --- |
| **Identity** | `User`, `OAuthAccount`, `Session`, `PasswordResetToken`, `EmailVerificationToken` |
| **Documents** | `Diagram`, `VisualDocument`, `DiagramTemplate` |
| **Libraries** | `CustomNodeSection`, `CustomNodeDefinition`, `CustomObject3D`, `Asset`, `DiagramAsset` |
| **Sketch to diagram** | `PreviewSourceSnapshot`, `DiagramPreview`, `DiagramConversion` |

The central decision is unchanged: a document's contents - pages, nodes, edges,
each node's 3D placement and each page's camera - are stored as **a single JSONB
column** rather than decomposed into tables of nodes, edges and points. A
document is only ever read and written whole, so normalising it would buy
nothing and cost a great many joins on every open. One row in, one row out.

Google sign-in is a row in `OAuthAccount` keyed by Google's stable subject id,
so an account survives a change of Google address. A `VisualDocument` links a
whiteboard to the diagram created from it. `DiagramAsset` records which images a
document uses, so a library clean-up can never delete an image that a saved
drawing still shows. The schema also carries database-level `CHECK`
constraints, so invalid state is refused even if application code has a bug.

## 🔐 Authentication

Sessions live **in the database**, not in a self-contained token. The browser
holds a random session token in an **httpOnly** cookie that application
JavaScript cannot read; the database stores only its SHA-256 hash. Every request
checks the session row, so signing a device out, or resetting a password, takes
effect on the very next request rather than whenever a token would have expired.

Because the API and the app are served from sibling hostnames under the same
domain, the cookie is first-party (`SameSite=Lax`). It survives the third-party
cookie restrictions that break split-domain setups in Safari and Firefox.

Passwords are hashed with **bcrypt**. Reset and verification links carry
single-use tokens that are stored hashed and expire; a reset link is claimed
inside the same transaction that changes the password, so it can never be spent
twice, and it signs out every existing session. Reset responses are identical
whether or not the address is registered, so the endpoint cannot be used to
discover who has an account.

Google sign-in binds each attempt to the browser that started it with a
single-use nonce, so a copied callback link cannot sign anyone in.

## 🛡️ Hardening

| Concern | Measure |
| --- | --- |
| Cross-site requests | Every state-changing request must come from the app's own origin; CORS is restricted to it, with credentials |
| Common header attacks | **Helmet** sets the standard security headers |
| Brute force and abuse | **Throttler** rate-limits the API, with tighter limits on authentication |
| Malformed input | **class-validator** checks every request body before it reaches the database |
| Races | Quota and ownership checks lock the owner's row first, so concurrent requests cannot overshoot a limit |
| Uploads | Images go to private S3 storage and are validated and re-encoded with **sharp** before they can be used |
| Database traffic | TLS with full certificate and hostname verification; anything weaker is refused in production |
| SQL injection | **Prisma** parameterises every query |

## 🤖 Sketch-to-diagram previews

The whiteboard is frozen into an immutable source snapshot before anything is
sent, so the preview always describes exactly what was drawn. The request goes
to the model **from the server** - the API key never reaches the browser - and
is bounded by per-user rate and daily limits and switched on by explicit
feature flags. Committing a preview converts exactly the version being viewed
into an editable diagram without calling the model again, and records the
conversion, so repeating the commit returns the same diagram instead of
creating a second one. A background
maintenance loop recovers stalled requests and expires old sources.

## ⚡ Caching and observability

Dashboard listings are cached per user - in **Redis** when one is configured,
in process otherwise - and dropped when that user changes a document.

Requests are logged as structured JSON with **Pino**, with query strings left
out so short-lived OAuth codes never reach the logs.

## ☁️ Running in production

The API runs as a container on **AWS ECS (Fargate)** behind a load balancer that
terminates TLS for `api.easydraw.net`, talking to **AWS RDS** for PostgreSQL and
private **Amazon S3** storage. Configuration and credentials are supplied by the
environment, never committed.

One `Dockerfile`, built from the repository root, produces two images for each
release: the API (production dependencies only, running as a non-root user and
shutting down cleanly when ECS stops it) and a one-off migration task. Releases
are reviewed and started by hand from GitHub Actions: the commit must have
passed CI, the database is migrated first, and the new version rolls out as a
canary that rolls itself back if it fails its health checks.

## 🛠️ Develop

From the repository root (the server is part of an npm workspace):

```sh
npm ci
npm run build:packages
cd server
npx prisma generate
npm run start:dev
```

Tests, including end-to-end tests against a disposable PostgreSQL on port 5433
(`docker-compose.test.yml`):

```sh
npm test
npx prisma migrate deploy --config prisma.test.config.ts
npm run test:e2e
npm run lint:check
```

Local settings live in a gitignored `server/.env`; `server/.env.example` lists
every variable.
