# StocksLab — Deployment Guide

> **Stack**: Render (Backend only) + Cloudflare Pages (Frontends) + Supabase (DB) + Aiven (Redis)
>
> **Why this split?** Render's free tier has a 5 GB/month bandwidth limit. By moving the 3 
> frontend apps to Cloudflare Pages (unlimited bandwidth), the 5 GB is used ONLY for 
> lightweight API JSON responses — making it last much longer.
>
> **Total Cost: $0/month**

---

## Quick Deploy Checklist

- [ ] Create new Render account → deploy backend only
- [ ] Set environment variables in Render dashboard
- [ ] Verify `https://your-backend.onrender.com/health`
- [ ] Create Cloudflare account → deploy 3 frontends
- [ ] Set `VITE_API_URL` on each Cloudflare Pages project
- [ ] Update Render env vars with actual Cloudflare Pages URLs
- [ ] Test everything

---

## 1. Backend — Render Setup

### Step 1: Create New Render Account

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Sign up with a **new email** (or GitHub)
3. No credit card needed

### Step 2: Create Backend Web Service

1. Click **New → Web Service**
2. Connect your GitHub repo: `shivamaggtdrx/Trading`
3. Configure:

| Setting | Value |
|---|---|
| **Name** | `stockslab-backend` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

### Step 3: Add Environment Variables

In Render dashboard → your service → **Environment**:

```
NODE_ENV = production
BACKEND_URL = https://api.stockslab.live
SUPABASE_URL = https://nrwyqkannylqwqxigozn.supabase.co
SUPABASE_ANON_KEY = your_anon_key
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
JWT_SECRET = <generate-a-strong-random-string>
JWT_EXPIRES_IN = 24h
FRONTEND_URL = https://stockslab-app.pages.dev
ADMIN_URL = https://stockslab-admin.pages.dev
LANDING_URL = https://stockslab-landing.pages.dev
REDIS_URL = rediss://default:AVNS_xxxxx@valkey-xxxxx.aivencloud.com:15432
FINNHUB_API_KEY = your_finnhub_key
SENTRY_DSN = your_sentry_dsn
RATE_LIMIT_WINDOW_MS = 900000
RATE_LIMIT_MAX = 500
```

> ⚠️ Update `FRONTEND_URL`, `ADMIN_URL`, `LANDING_URL` with actual Cloudflare Pages URLs after deploying the frontends, and make sure `BACKEND_URL` is set to your custom backend domain (e.g. `https://api.yourdomain.com`).

### Step 4: Deploy

Render auto-deploys from your GitHub main branch. Your backend URL will be:
`https://stockslab-backend.onrender.com`

---

## 2. Frontends — Cloudflare Pages

### Step 1: Create Cloudflare Account

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up (free, no credit card)
2. Go to **Workers & Pages** in the sidebar

### Step 2: Deploy Each Frontend

Repeat for **trader-app**, **admin-panel**, and **landing**:

1. Click **Create → Pages → Connect to Git**
2. Select your GitHub repository
3. Configure:

| Setting | trader-app | admin-panel | landing |
|---|---|---|---|
| **Project name** | `stockslab-app` | `stockslab-admin` | `stockslab-landing` |
| **Root directory** | `apps/trader-app` | `apps/admin-panel` | `apps/landing` |
| **Build command** | `npm install && npm run build` | `npm install && npm run build` | `npm install && npm run build` |
| **Build output** | `dist` | `dist` | `dist` |

4. **Environment Variables**:

| Variable | trader-app | admin-panel | landing |
|---|---|---|---|
| `VITE_API_URL` | `https://stockslab-backend.onrender.com/api` | `https://stockslab-backend.onrender.com/api` | `https://stockslab-backend.onrender.com/api` |
| `VITE_WS_URL` | `wss://stockslab-backend.onrender.com/ws/prices` | *(not needed)* | *(not needed)* |
| `NODE_VERSION` | `20` | `20` | `20` |

5. Click **Save and Deploy**

> The `_redirects` file in each `public/` folder handles SPA routing automatically.

### Step 3: Update Render CORS URLs

After Cloudflare deploys, go back to Render and update:
- `FRONTEND_URL` = your actual Cloudflare trader-app URL
- `ADMIN_URL` = your actual Cloudflare admin URL  
- `LANDING_URL` = your actual Cloudflare landing URL

---

## 3. Custom Domains

### Backend (Render)
1. In Render → your service → **Settings → Custom Domains**
2. Add `api.yourdomain.com`
3. Add CNAME: `api.yourdomain.com → stockslab-backend.onrender.com`

### Frontends (Cloudflare Pages)
1. In each project → **Custom Domains**
2. Add your domains and CNAME records:
   ```
   app.yourdomain.com   → CNAME → stockslab-app.pages.dev
   admin.yourdomain.com → CNAME → stockslab-admin.pages.dev
   yourdomain.com       → CNAME → stockslab-landing.pages.dev
   ```

---

## 4. Bandwidth Optimization

With this setup, Render's 5 GB bandwidth is used **only** for:
- API JSON responses (tiny: ~1-5 KB each)
- WebSocket messages (tiny: ~100 bytes each)
- Health check pings (tiny)

**NOT used for** (these go through Cloudflare's unlimited bandwidth):
- React bundles (~500 KB - 2 MB per app)
- CSS, images, fonts
- Static assets

This should make the 5 GB last **much longer**.

---

## Cost Summary

| Service | Monthly Cost |
|---|---|
| Render (Backend API only) | **$0** |
| Cloudflare Pages (3 frontends) | **$0** (unlimited BW) |
| Supabase (Database) | **$0** |
| Aiven (Redis/Valkey) | **$0** |
| **Total** | **$0/month** |
