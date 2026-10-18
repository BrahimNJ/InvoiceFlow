# Deployment

InvoiceFlow is deployed automatically after every push or merge on `main`, **only when CI is green**.
Nobody deploys by hand: GitHub Actions is the only path to production.

## Live environments

| Part | Host | URL |
|------|------|-----|
| Frontend (Angular) | Vercel | https://invoice-flow-seven-omega.vercel.app |
| Backend (Spring Boot) | Render, Docker web service `invoiceflow-backend` (Frankfurt, free plan) | https://invoiceflow-backend-84wn.onrender.com |
| Database (PostgreSQL) | Neon (Frankfurt) | private, only reachable by the backend |

Quick checks:

```bash
curl https://invoiceflow-backend-84wn.onrender.com/actuator/health   # {"status":"UP"} (includes the database)
curl -i https://invoiceflow-backend-84wn.onrender.com/api/customers  # 401: the API requires a sign-in (#19)
```

## How the frontend reaches the backend

The two apps live on different origins, so the browser applies CORS.

| Side | Setting | Dev | Prod |
|------|---------|-----|------|
| Angular | `apiUrl` in `frontend/src/environments/` | `http://localhost:8080` (`environment.development.ts`, used by `ng serve`) | `https://invoiceflow-backend-84wn.onrender.com` (`environment.ts`, used by `ng build`) |
| Spring Boot | `app.cors.allowed-origins` (`CORS_ALLOWED_ORIGINS`) | `http://localhost:4200` | `https://invoice-flow-seven-omega.vercel.app` |

CORS covers `/api/**` (GET, POST, PUT, DELETE, with credentials for the refresh token cookie) and `/actuator/health`
(GET, used by the status indicator in the page footer).

Because the two apps are on **different sites**, the refresh token cookie is sent with `SameSite=None; Secure`
in prod (`REFRESH_COOKIE_SAME_SITE`, default `None`). Browsers that block third-party cookies (Safari) do not
send it: users stay signed in for the access token lifetime (15 min) only. The fix is to serve the API under the
frontend domain (follow-up, see [`authentication.md`](authentication.md)).
If the Vercel URL changes (custom domain, new project), set `CORS_ALLOWED_ORIGINS` on Render and update `environment.ts` if the backend URL changes.

## What happens on a merge to `main`

```
merge / push on main
  │
  ├─► Backend CI  (backend-ci.yml)   ./mvnw verify on H2 + Flyway migrations
  │       │ success only
  │       ▼
  │   Deploy backend (deploy-backend.yml)
  │       POST RENDER_DEPLOY_HOOK_URL
  │       ▼
  │   Render: clone main ─► docker build backend/ ─► start container (prod profile)
  │       ▼
  │   Spring Boot starts ─► Flyway migrates Neon ─► Hibernate validates schema
  │       ▼
  │   Render health check /actuator/health = UP ─► traffic switches to the new container
  │
  └─► Frontend CI (frontend-ci.yml)  npm ci, ng build, Vitest
          │ success only
          ▼
      Deploy frontend (deploy-frontend.yml), on the exact commit that passed CI
          vercel pull ─► vercel build --prod ─► vercel deploy --prebuilt --prod
          ▼
      Vercel production URL serves the new build
```

1. **CI runs first.** `Backend CI` and `Frontend CI` run on every push to `main` and to issue branches
   (`<issue>-<type>/<name>`), and on every pull request.
2. **Deploy workflows wait for CI.** They are triggered by `workflow_run` when a CI workflow *completes*.
   The job only runs if that CI run was a `push` on `main` **and** succeeded. A red CI deploys nothing.
3. **Backend deploy.** The workflow calls the Render deploy hook. Render then clones `main`, builds
   `backend/Dockerfile` (Maven package, JRE 21 runtime, non-root user) and starts it with `SPRING_PROFILES_ACTIVE=prod`.
   On startup Flyway applies any new migration to Neon. Render only routes traffic to the new container once
   `/actuator/health` answers `UP`; if it never does, the previous version keeps running.
4. **Frontend deploy.** The workflow checks out the commit that passed `Frontend CI` and runs the Vercel CLI
   from the repository root. Using the project settings pulled from Vercel (Root Directory `frontend`), it runs
   `npm ci` and `npm run build` from `frontend/vercel.json`, then uploads the prebuilt output as the production deployment.
5. Each deploy workflow is serialized (`concurrency`), so two merges in a row never deploy in parallel.

Both workflows can also be started manually from **Actions → Deploy frontend / Deploy backend → Run workflow**,
on `main` only. Use it to redeploy without a code change.

Typical durations: CI ~1 min, frontend deploy ~1 min, backend deploy 5–10 min (Docker build on Render).

## Files that drive deployment

| File | Role |
|------|------|
| `.github/workflows/backend-ci.yml`, `frontend-ci.yml` | Build and test; their success triggers the deploys |
| `.github/workflows/deploy-backend.yml` | Calls the Render deploy hook |
| `.github/workflows/deploy-frontend.yml` | Vercel CLI pull / build / deploy |
| `backend/Dockerfile`, `backend/.dockerignore` | Backend image built by Render |
| `render.yaml` | Render Blueprint: service definition, health check, env var names |
| `frontend/vercel.json` | Angular output directory, SPA fallback, Vercel Git deploys disabled |
| `backend/src/main/resources/application-prod.properties` | Production config, all values from environment variables |
| `backend/src/main/resources/db/migration/` | Flyway migrations applied to Neon at startup |

## Secrets

Nothing secret is stored in the repository. GitHub never shows a secret again; to change one, overwrite it.

| Name | Stored in | Where to get it |
|------|-----------|-----------------|
| `VERCEL_TOKEN` | GitHub → Settings → Secrets and variables → Actions | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | GitHub (same place) | Vercel → Team Settings → General → Team ID |
| `VERCEL_PROJECT_ID` | GitHub (same place) | Vercel → Project → Settings → General → Project ID |
| `RENDER_DEPLOY_HOOK_URL` | GitHub (same place) | Render → service → Settings → Deploy Hook |
| `DB_URL` | Render → service → Environment | Neon → Connect, converted to `jdbc:postgresql://<host>/<db>?sslmode=require` |
| `DB_USERNAME`, `DB_PASSWORD` | Render → service → Environment | Neon → Connect |
| `SPRING_PROFILES_ACTIVE=prod` | Render → service → Environment | Fixed value (also the Docker image default) |
| `CORS_ALLOWED_ORIGINS` (optional) | Render → service → Environment | Comma-separated frontend origins; defaults to the Vercel production URL (not a secret) |
| `JWT_SECRET` | Render → service → Environment | Generated by Render (`generateValue` in `render.yaml`). Manual value: `openssl rand -base64 32`. At least 32 bytes |
| `REFRESH_COOKIE_SAME_SITE` (optional) | Render → service → Environment | `None` (default, cross-site) or `Strict` once the API is served from the frontend domain |

Neon gives `postgresql://user:password@host/db?sslmode=require`. Spring Boot needs the JDBC form:
prefix with `jdbc:`, remove `user:password@`, and set the user and password in their own variables.

Rotate a secret: create the new value on the platform, overwrite the secret (GitHub or Render), then revoke the old one.
Rotating `JWT_SECRET` invalidates every access token: users are signed in again silently through their refresh cookie.
The deploy hook URL is a credential: anyone who has it can trigger a deploy.

## Platform settings that must match the repository

**Render → invoiceflow-backend → Settings**

| Setting | Value | Why |
|---------|-------|-----|
| Runtime | Docker | |
| Branch | `main` | |
| Root Directory | *empty* | Render prefixes it to the Docker context; `backend` gave `backend/backend` (#11) |
| Dockerfile Path | `./backend/Dockerfile` | |
| Docker Build Context | `./backend` | |
| Health Check Path | `/actuator/health` | |
| Auto-Deploy | **Off** | Otherwise Render deploys on every commit without waiting for CI, and twice with the hook |

**Vercel → project → Settings**

| Setting | Value | Why |
|---------|-------|-----|
| Framework Preset | Angular | |
| Root Directory | `frontend` | The workflow runs the CLI from the repository root and Vercel enters `frontend/` itself (#15) |
| Git deployments | disabled by `frontend/vercel.json` (`git.deploymentEnabled: false`) | Deploys only come from GitHub Actions, after CI |

## Checking a deployment

1. **GitHub → Actions**: after a merge you should see, in order, `Backend CI` + `Frontend CI`, then
   `Deploy backend` + `Deploy frontend`, all green. The frontend run shows the deployment URL.
2. **Render → service → Events / Logs**: the deploy goes *Build → Deploy → Live*. Startup logs show
   `The following 1 profile is active: "prod"` and Flyway's `Successfully applied … migration` or `Schema … is up to date`.
3. **Vercel → project → Deployments**: the newest production deployment matches the commit.
4. **Smoke test**: the two `curl` commands at the top of this page.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Render: `lstat /opt/render/project/src/backend/backend: no such file or directory` | Root Directory set to `backend` | Empty Root Directory (see settings above) |
| Deploy backend: `RENDER_DEPLOY_HOOK_URL secret is not set` | Missing GitHub secret | Add it, rerun the workflow |
| Deploy frontend: `You specified VERCEL_ORG_ID but you forgot to specify VERCEL_PROJECT_ID` | Missing GitHub secret | Add `VERCEL_PROJECT_ID`, rerun |
| Deploy frontend: `sh: 1: ng: not found` / `Command "ng build" exited with 127` | CLI run inside `frontend/` while Root Directory is `frontend`: it resolved `frontend/frontend`, skipped `npm ci` and ignored `vercel.json` | Run the CLI from the repository root (done in `deploy-frontend.yml`, #15) |
| Deploy frontend: `Project not found` | `VERCEL_ORG_ID` is not the team that owns the project, or the token has no access to it | Overwrite `VERCEL_ORG_ID` with the right Team ID |
| Backend starts then crashes: `'url' must start with "jdbc"` | `DB_URL` missing or in `postgresql://` form | Use the JDBC form |
| Backend crashes: `password authentication failed` / `Connection refused` | Wrong Neon credentials or host | Copy them again from Neon |
| Backend crashes: `Schema-validation: missing column …` | Entity changed without a Flyway migration | Add `V<n>__<description>.sql`, never edit an applied one |
| Backend crashes: `app.security.jwt.secret (JWT_SECRET) must be at least 32 bytes` / `Could not resolve placeholder 'JWT_SECRET'` | `JWT_SECRET` missing or too short | Add it on Render (see Secrets), redeploy |
| Signed out after ~15 min on Safari | Third-party cookies blocked: the cross-site refresh cookie is not sent | Expected until the API is served under the frontend domain |
| Browser console: `blocked by CORS policy: No 'Access-Control-Allow-Origin' header` | Frontend origin not in `CORS_ALLOWED_ORIGINS` | Add the exact origin (scheme + host, no trailing slash) on Render, redeploy |
| First request takes ~1 minute | Render free plan sleeps after 15 min without traffic | Expected; upgrade the plan to avoid it |
| Deploy workflow skipped | CI failed, or the push was not on `main` | Fix CI; deploys only follow green CI on `main` |

## Rollback

- **Frontend**: Vercel → Deployments → previous production deployment → *Promote to Production* (instant).
- **Backend**: Render → service → Events → previous successful deploy → *Rollback*.
  A rollback does not undo Flyway migrations: keep migrations backward compatible, or ship a new migration to revert.
- **Durable fix**: revert the commit on `main` with a PR; CI and the deploys then run normally.

## First-time setup (already done)

1. **Neon**: project in `eu-central-1` (Frankfurt), keep the default database and role.
2. **Render**: *New → Blueprint* on this repository, branch `main`; enter `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`.
   Apply the settings above, then copy the deploy hook URL into GitHub.
3. **Vercel**: *Add New → Project*, import the repository, framework Angular, Root Directory `frontend`.
   Create a token and copy the team and project ids into GitHub.
4. **GitHub**: add the four Actions secrets.
5. Run both deploy workflows once manually, then check as described above.
