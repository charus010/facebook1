# FB Video Automation — Phase 1 (Frontend, sample data)

Next.js 14 + TypeScript + Tailwind CSS 3 + Recharts. **All data is sample data; nothing talks to Facebook.**
Pinned versions are in `package.json`.

## Local run
```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```
Requires Node.js 18.18+ (20 LTS recommended).

## GitHub + Vercel
```bash
git init && git add . && git commit -m "Phase 1 frontend"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
Then on vercel.com: **Add New → Project → import the repo**. Framework is auto-detected as Next.js; no env vars are needed for Phase 1. Click Deploy.

## Notes
- Sample data lives in `lib/mock-data.ts`; state in `lib/store.tsx` (in-memory, resets on refresh).
- Phase 2+ backend (FastAPI, PostgreSQL, Redis, Celery workers) needs a long-running server (Docker on a VPS/cloud VM) — it cannot run on Vercel. Vercel will host only this frontend and call the API over HTTPS.

## Two modes
- **Sample-data mode (default):** `NEXT_PUBLIC_API_URL` is not set. Everything works with in-memory sample data, as in Phase 1.
- **Live mode:** set `NEXT_PUBLIC_API_URL` to your backend's HTTPS URL (no trailing slash). A login screen appears and all data comes from the FastAPI backend.

### Using live mode on Vercel
1. Run the backend on a server with HTTPS (Vercel pages are HTTPS, so an `http://` API will be blocked by the browser).
2. In the backend `.env`, set `CORS_ORIGINS` to your Vercel URL (e.g. `https://your-app.vercel.app`) and restart the API.
3. Configure CORS on your storage bucket to allow `PUT` from your Vercel URL (needed for direct video uploads).
4. Vercel → Project → Settings → Environment Variables → add `NEXT_PUBLIC_API_URL`, then Redeploy.

Locally: copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_API_URL=http://localhost:8000`, run `npm run dev`.

In live mode the login token is kept in `sessionStorage` (cleared when the tab closes) and sent as a Bearer header.
Not yet live: Meta login/page discovery (Phase 3), publishing and real analytics charts (Phase 4).
