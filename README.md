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
