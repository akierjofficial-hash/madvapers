# Mad Vapers Inventory System (Frontend)

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Backend must be running at `http://127.0.0.1:8000` (or update `VITE_API_BASE_URL`).

Notes:
- Auth uses Sanctum personal access tokens. Token is stored in `localStorage`.
- A global Axios 401 interceptor clears the token and redirects back to `/login`.
- `VITE_AUTH_STRATEGY=token` is recommended for separate frontend/backend deploy domains.
