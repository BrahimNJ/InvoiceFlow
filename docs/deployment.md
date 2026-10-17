# Deployment

InvoiceFlow is deployed automatically after every push or merge on `main`, **only when CI is green**.

```
push / merge on main
  ├─ Frontend CI ── success ──► Deploy frontend ──► Vercel (Vercel CLI, prebuilt)
  └─ Backend CI  ── success ──► Deploy backend  ──► Render deploy hook ──► Docker build ──► Spring Boot (prod)
                                                                                              │
                                                                                     Neon PostgreSQL (Flyway migrates at startup)
```

| Part | Host | Config in repo | Workflow |
|------|------|----------------|----------|
| Frontend (Angular) | Vercel | `frontend/vercel.json` | `.github/workflows/deploy-frontend.yml` |
| Backend (Spring Boot) | Render, Docker web service | `backend/Dockerfile`, `render.yaml` | `.github/workflows/deploy-backend.yml` |
| Database | Neon (managed PostgreSQL) | `backend/src/main/resources/db/migration` | — (Flyway at backend startup) |

Vercel has no Java runtime, which is why the backend runs on Render.

A failed CI run deploys nothing. Both deploy workflows can also be started manually
(**Actions → Deploy … → Run workflow**, on `main` only).

## Secrets

Nothing secret is stored in the repository.

| Name | Where | Value |
|------|-------|-------|
| `VERCEL_TOKEN` | GitHub repository secret | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | GitHub repository secret | `orgId` in `frontend/.vercel/project.json` after `vercel link` (or Team Settings → Team ID) |
| `VERCEL_PROJECT_ID` | GitHub repository secret | `projectId` in the same file (or Project Settings → Project ID) |
| `RENDER_DEPLOY_HOOK_URL` | GitHub repository secret | Render → service → Settings → Deploy Hook |
| `DB_URL` | Render environment variable | `jdbc:postgresql://<neon-host>/<database>?sslmode=require` |
| `DB_USERNAME` | Render environment variable | Neon role |
| `DB_PASSWORD` | Render environment variable | Neon role password |

Neon shows a `postgresql://user:password@host/db?sslmode=require` URL. Spring Boot needs the JDBC form:
prefix with `jdbc:`, remove `user:password@`, and pass the user and password separately.

## First-time setup

1. **Neon** — create a project (region `eu-central-1` / Frankfurt, close to Render), keep the database and role it creates.
2. **Render** — *New → Blueprint*, select this repository: `render.yaml` creates `invoiceflow-backend`.
   Enter `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` when prompted. Copy the deploy hook URL into the GitHub secret.
3. **Vercel** — *Add New → Project*, import this repository, framework **Angular**, Root Directory left empty
   (the workflow runs the CLI inside `frontend/`). Create a token, copy the org and project ids into GitHub secrets.
4. **GitHub** — *Settings → Secrets and variables → Actions*: add the four secrets above.
5. Merge to `main` (or run both deploy workflows manually) and check:
   - `https://<render-service>.onrender.com/actuator/health` → `{"status":"UP"}`
   - the Vercel production URL shows the Angular app.

## Notes

- Render's free plan sleeps after 15 minutes without traffic; the first request then takes ~1 minute.
- Auto-deploy is disabled on both platforms (`autoDeployTrigger: "off"`, `git.deploymentEnabled: false`)
  so that GitHub Actions is the only path to production.
- Schema changes ship as new Flyway migrations; they run automatically when the new backend starts.
