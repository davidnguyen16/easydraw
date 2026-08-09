<h1 align="center">EasyDraw — Server</h1>

<p align="center">
  The API behind accounts and saved diagrams.
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
deliberately small: authenticate a person, and store or return their diagrams.
None of the drawing logic lives here — the editor does that work in the
browser, which keeps the API fast and the running cost low.

## 🔌 API surface

**Authentication**

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Sign in, set the session cookie |
| `POST` | `/auth/logout` | Clear the session |
| `GET` | `/auth/me` | Who is signed in — drives the route guards |
| `GET` | `/auth/google` → `/auth/google/callback` | Google OAuth sign-in |
| `POST` | `/auth/forgot-password` | Send a reset link |
| `POST` | `/auth/reset-password` | Set a new password from that link |
| `DELETE` | `/auth/account` | Delete the account and its diagrams |

**Diagrams** — every route is scoped to the signed-in owner.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/diagrams` | List the dashboard |
| `POST` | `/diagrams` | Create |
| `GET` | `/diagrams/:id` | Open one |
| `PATCH` | `/diagrams/:id` | Save title, status and contents |
| `DELETE` | `/diagrams/:id` | Delete |

An interactive reference is generated from the code with Swagger.

## 🗃️ Data model

Two tables. A **user** holds an email, an optional password hash and an
optional Google id — either can be absent, which is what lets the same account
be reached by password or by Google. A **diagram** belongs to one user and
keeps its title, type, status and contents.

The interesting decision is that a diagram's contents are stored as **a single
JSONB column** rather than being decomposed into tables of nodes, edges and
points. A diagram is only ever read and written whole, so normalising it would
buy nothing and cost a great many joins on every open. One row in, one row out.

## 🔐 Authentication

Sessions are a **JWT in an httpOnly cookie**. Application JavaScript cannot
read it, which keeps the token out of reach of cross-site scripting, and the
browser attaches it automatically so the client never handles a token at all.

Because the API and the app are served from sibling hostnames under the same
domain, the cookie is first-party — it survives the third-party cookie
restrictions that break split-domain setups in Safari and Firefox.

Passwords are hashed with **bcrypt**. Password-reset links carry a single-use
token that is stored hashed and expires shortly after it is issued, so a leaked
database still yields no usable reset link. Reset responses are deliberately
identical whether or not the address is registered, so the endpoint cannot be
used to discover who has an account.

## 🛡️ Hardening

| Concern | Measure |
| --- | --- |
| Common header attacks | **Helmet** sets the standard security headers |
| Brute force | **Throttler** rate-limits authentication routes |
| Malformed input | **class-validator** checks every request body before it reaches the database |
| Cross-origin abuse | CORS is restricted to the app's own origin, with credentials |
| SQL injection | **Prisma** parameterises every query |

## ⚡ Caching and observability

Dashboard listings are cached in **Redis** and keyed per user, so returning to
the dashboard does not re-query the database each time; the cache is dropped
when that user changes a diagram.

Requests are logged as structured JSON with **Pino**, which makes them
searchable once shipped to log storage rather than something you read by eye.

## ☁️ Running in production

The API runs as a container on **AWS ECS** behind a load balancer that
terminates TLS for `api.easydraw.net`, talking to **AWS RDS** for PostgreSQL.
Configuration and credentials are supplied by the environment, never committed.
Deployments are automated from the main branch by GitHub Actions.
