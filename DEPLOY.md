# Mad Vapers Deployment Guide (Security + CSRF Safe)

This guide is optimized for deployments where frontend and backend use different domains (for example, two Railway services).

## Recommended Mode

Use **token-based API auth** for production.

- Frontend: `VITE_AUTH_STRATEGY=token`
- Backend: keep Sanctum token auth enabled (already in code)
- Benefit: avoids cross-domain cookie/CSRF mismatch errors

## 1) Frontend Environment

Set these in your frontend service:

```env
VITE_API_BASE_URL=https://<your-backend-domain>/api
VITE_AUTH_STRATEGY=token
VITE_REALTIME_POLLING=true
```

Example:

```env
VITE_API_BASE_URL=https://madvapers-backend.up.railway.app/api
VITE_AUTH_STRATEGY=token
```

## 2) Backend Environment

Set these in backend service:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://<your-backend-domain>

CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>
LOGIN_ALLOWED_ORIGINS=https://<your-frontend-domain>

# Token mode: no stateful cookie domains required
SANCTUM_STATEFUL_DOMAINS=

SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
```

Example:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://madvapers-backend.up.railway.app
CORS_ALLOWED_ORIGINS=https://madvapers-frontend.up.railway.app
LOGIN_ALLOWED_ORIGINS=https://madvapers-frontend.up.railway.app
SANCTUM_STATEFUL_DOMAINS=
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
```

## 3) Why This Fixes "CSRF Token Invalid"

`CSRF token invalid` usually appears when browsers block or mis-scope cookies across domains.
In token mode, authenticated API calls use `Authorization: Bearer <token>` instead of cross-site session cookies, so CSRF cookie mismatch is no longer on the critical path.

## 4) Security Checklist

- Keep `APP_DEBUG=false` in production.
- Keep `CORS_ALLOWED_ORIGINS` strict (exact frontend origin only).
- Keep `LOGIN_ALLOWED_ORIGINS` strict for `/api/auth/login` requests.
- Never commit cookie jar files (`tmp_*cookies*.txt`, `*.cookiejar`).
- If sensitive artifacts were pushed before, rotate sessions/tokens.
- Use HTTPS for frontend and backend.

## 5) Optional: Cookie-Based Sanctum Mode

Only use cookie mode if both apps are on same-site subdomains with full cookie configuration:

```env
SANCTUM_STATEFUL_DOMAINS=app.example.com,api.example.com
SESSION_DOMAIN=.example.com
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=none
CORS_ALLOWED_ORIGINS=https://app.example.com
```

Also set frontend:

```env
VITE_AUTH_STRATEGY=cookie
```
