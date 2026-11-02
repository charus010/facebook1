# Meta (Facebook) setup — Phase 3

Meta's dashboard changes often. If a screen below does not match, search the dashboard for the setting name in quotes.

## 1. Meta Developer App (once)
1. developers.facebook.com → **Create App** → use case **Manage everything on your Page** (Pages API).
2. **App settings → Basic**: copy **App ID** and **App Secret** (keep the secret private; it only goes in the backend `.env`).
3. Find the Facebook Login settings for the app (inside the use case: *Customize* / *Settings*) and:
   - turn **Client OAuth Login** and **Web OAuth Login** ON;
   - add your callback to **Valid OAuth Redirect URIs** — it must match `META_REDIRECT_URI` character for character:
     - local: `http://localhost:8000/api/meta/callback`
     - production: `https://api.yourdomain.com/api/meta/callback`
4. Keep the app in **Development mode** while testing. Only people with a role on the app (Admin / Developer / Tester) can log in.
   Add each Facebook account you want to connect under **App roles → Roles** and accept the invitation from that account.

## 2. Environment variables (backend `.env`)
| Variable | Meaning |
|---|---|
| `META_MODE` | `mock` (no Facebook needed; tests/demo) or `live`. `APP_MODE=production` refuses to start with `mock`. |
| `META_APP_ID`, `META_APP_SECRET` | From App settings → Basic. Required when `META_MODE=live`. |
| `META_REDIRECT_URI` | The callback URL above. |
| `META_API_VERSION` | Graph API version used in every URL (default `v25.0`). Change only here and re-test. |
| `META_SCOPES` | Comma-separated permissions requested at login. Default is the minimum: `pages_show_list,pages_read_engagement,pages_manage_posts`. |
| `FRONTEND_URL` | Where the browser returns after login (your Vercel URL, or `http://localhost:3000`). |
| `CORS_ORIGINS` | Must include the same frontend URL. |

## 3. Permissions
Default request: `pages_show_list` (list Pages), `pages_read_engagement`, `pages_manage_posts` (publish). Before Phase 4 add:
- `publish_video` for video posts, `read_insights` for views — only after they appear as available in your app's use case
  (an unavailable scope makes the login dialog fail with an "invalid scope" error).
- The person who logs in must also have a role on each Page that allows creating content (task `CREATE_CONTENT`).
  The app checks this per Page: Pages without it are imported as **needs attention** and cannot be resumed.

## 4. App Review / going beyond your own accounts
In Development mode no review is needed for people who have a role on the app. To let accounts **without** a role connect, Meta requires the
app to be reviewed and (for most permissions) set to Live, and may ask for Business Verification. Check the current requirements in the
App Dashboard → App Review before you promise this to anyone.

## 5. Token behaviour (what the code assumes)
- Login returns a short-lived user token → the backend exchanges it for a long-lived user token (~60 days) → `/me/accounts` returns a Page token per Page.
- Page tokens obtained from a long-lived user token have no expiry of their own, but stop working if the person changes their Facebook
  password, loses their Page role, or removes the app. Meta then returns error code 190; the app marks the account and all its Pages
  **Needs Reauthorization**, pauses them, and shows a Reconnect button.
- Tokens are Fernet-encrypted in the database, never returned by the API, never written to logs.

## 6. Local development
```
META_MODE=mock          # whole flow works with fake Pages, no Facebook account
META_MODE=live  META_APP_ID=...  META_APP_SECRET=...  META_REDIRECT_URI=http://localhost:8000/api/meta/callback
```
Automated tests never need Facebook credentials (`pytest -q`).

## 7. Flow
Add account → **Connect with Facebook** → Meta login → callback → account *connected* → **Discover pages** → tick Pages → **Import**
(imported Pages start paused) → set daily plan → Resume. Later: **Sync pages** refreshes names/permissions and flags Pages that disappeared.
